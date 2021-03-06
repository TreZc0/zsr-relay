
'use strict';

const Discord = require('discord.js');
const request = require('request');
const request2 = require('request-promise');
const easyjson = require('easyjson');
const editJsonFile = require("edit-json-file");
const path = require('path');
const events = require('events');
var emitter = require('./emitter');
// Ours
const nodecg = require('./util/nodecg-api-context').get();

const twitchPlayer = nodecg.Replicant('twitchPlayer');
const currentRun = nodecg.Replicant('currentRun');
const runners = nodecg.Replicant('runners');
const teams = nodecg.Replicant('teams');
const log = new nodecg.Logger(`${nodecg.bundleName}:discord`);
const schedule = nodecg.Replicant('schedule');
const stopwatch = nodecg.Replicant('stopwatch');
const leaderboard = nodecg.Replicant('leaderboard');

const resultSnap = nodecg.Replicant('resultSnapRelay', 'external-assets');

const discordRep = nodecg.Replicant('discord', {
	defaultValue: {
		signupActive: false,
		raceSetup: false,
		raceHasStarted: false,
		raceInProgress: false,
		raceFinished: false
	}, persistent: true
});

const voiceActivity = nodecg.Replicant('voiceActivity', {
	defaultValue: {
		members: []
	}, persistent: true
});

const bot = new Discord.Client();

const testMode = false; //TEST MODE; TURN OFF WHEN RUNNING SERVER IN PRODUCTION

const zsrBotToken = nodecg.bundleConfig.discordBotToken;
const zsrServerID = "244939773121265664";

const zsrStreamChannelID = "378757983229706260";

const zsrSignupChannelID = testMode ? "384488486327025665" : "376632794094370816";
const zsrRaceChannelID = testMode ? "384488567038017538" : "376157053653221397";
const zsrCommentaryChannelID = testMode ? "384488630368075777" : "379630074816888832";

const zsrVoiceCommentaryChannelID = "244939773121265665";

const zsrRaceRegisteredID = "376633404000829440";
const zsrRaceCommentaryID = "376918888476180490";
const zsrRaceEnteredID = "376185805523255318";
const zsrRaceReadyID = "376186444026478592";
const zsrCommentatorID = "244948966603620352";

const zsrDiscordAuthLink = "http://zelda.speedruns.com/race-signup";

const basePathCover = "https://zsr-nodecg.eu/external_assets/img/cover/";
const basePathIcon = "https://zsr-nodecg.eu/external_assets/img/logo/";
const basePathAssets = "https://zsr-nodecg.eu/external_assets/img/";

var botIsReady = false;
var raceTopic = "";
var raceConcludedGraceTimeout;
var raceConcludedTimerTimeout;


runners.on('change', newVal => {
	if (!botIsReady)
		return;

	if (!newVal)
		return;

	_updateTopics(newVal);
});

stopwatch.on('change', newVal => {
	if (!botIsReady)
		return;

	if (!newVal)
		return;

	if (discordRep.value.raceInProgress == true && discordRep.value.raceFinished == false)
		_updateTimerTopic(newVal);
});

bot.on('ready', () => {
	log.info('Logged in as %s - %s\n', bot.user.username, bot.user.id);
	log.info('Signups Accepted: ' + discordRep.value.signupActive);

	botIsReady = true;
	
	_updateTopics(runners.value);

	if (testMode) {
		console.log("Bot is in TEST MODE!");
	}
});

bot.on('error', () => {
	log.error("The bot encountered a connection error!!");

	botIsReady = false;

	setTimeout(() => {

		bot.login(zsrBotToken);
	}, 10000);
});

bot.on('disconnect', () => {
	log.error("The bot disconnected!!");

	botIsReady = false;

	setTimeout(() => {

		bot.login(zsrBotToken);
	}, 10000);
});

bot.on('voiceStateUpdate', () => {

	UpdateCommentaryChannelMembers();

});

function UpdateCommentaryChannelMembers()
{
	if (!voiceActivity || !voiceActivity.value)
		return;

	var memberArray = Array.from(bot.guilds.get(zsrServerID).channels.get(zsrVoiceCommentaryChannelID).members.values());

	if (!memberArray || memberArray.length < 1)
	{
		voiceActivity.value.members.length = 0;
		return;
	}

	var newVoiceArray = [];

	memberArray.forEach(voiceMember => {

		if (voiceMember.user.tag != "ZSRBot#6583" && voiceMember.user.tag != "ZeldaSpeedRuns#9998")
		{
			let userAvatar = voiceMember.user.avatarURL;

			if (!userAvatar || userAvatar == null)
				userAvatar = "https://discordapp.com/assets/dd4dbc0016779df1378e7812eabaa04d.png"; //default avatar

			let speakStatus = voiceMember.speaking;

			if (!speakStatus || speakStatus == null)
				speakStatus = false;

			newVoiceArray.push({ id: voiceMember.user.id, name: voiceMember.displayName, avatar: userAvatar, isSpeaking: speakStatus });
		}
	});

	voiceActivity.value.members = newVoiceArray;
}

//STREAM CHANNEL
function streamChannel(message) {
	//MOD COMMANDS
	if (message.member.hasPermission("MANAGE_MESSAGES")) {
		if (message.content.toLowerCase() === "!commands") {
			message.reply("MOD: [!clear]");
			return;
		}
		else if (message.content.toLowerCase() === "!clear") {
			_clearChat(zsrStreamChannelID);
			return;
		}
	}
}

//SIGNUP CHANNEL
function signupChannel(message) {
	//ADMIN COMMANDS
	if (message.member.hasPermission("MANAGE_CHANNELS")) {
		if (message.content.toLowerCase() === "!commands") {
			message.reply("ADMIN: [!clear | !signup on | !signup off | !race setup | !race reset | !add runner *{discordTag}* | !remove runner *{discordTag}*] \nUSER: [!enter | !join commentary | !leave commentary | !show profile | !update profile | !unregister]");
			return;
		}
		else if (message.content.toLowerCase() === "!clear") {
			_clearChat(zsrSignupChannelID);
			return;
		}
		else if (message.content.toLowerCase() === "!race setup") {

			if (discordRep.value.raceHasStarted == true) {
				message.reply("The race was already setup!");
				return;
			}

			if (runners.value.length == 0) {
				message.reply("Can't setup a race with 0 runners :(");
				return;
			}

			if (discordRep.value.raceSetup == true) {
				message.reply("The race was already setup. Updating roles only...");

				_initOrResetRace(true, message);

				return;
			}

			discordRep.value.signupActive = false;

			message.channel.setTopic("[IN PROGRESS] " + currentRun.value.longName + " " + currentRun.value.category + " Race (" + runners.value.length + " entrant(s))", "Race is setup");
			bot.guilds.get(zsrServerID).channels.get(zsrCommentaryChannelID).setTopic("[IN PROGRESS] " + currentRun.value.longName + " " + currentRun.value.category + " Race", "Race is setup");
	
			_initOrResetRace(true, message);

			return;
		}
		else if (message.content.toLowerCase() === "!race reset") {

			discordRep.value.signupActive = false;
			discordRep.value.raceSetup = false;
			discordRep.value.raceHasStarted = false;
			discordRep.value.raceInProgress = false;
			discordRep.value.raceFinished = false;

			if (runners.value)
				runners.value.length = 0;
			else
				runners.value = [];
			
			if (teams.value)
				teams.value.teams.length = 0;
			else
				teams.value.teams = [];

			leaderboard.value.ranking.length = 0;

			setTimeout(() => {

				bot.guilds.get(zsrServerID).channels.get(zsrSignupChannelID).setTopic(" ", "Race is reset");
				bot.guilds.get(zsrServerID).channels.get(zsrRaceChannelID).setTopic(" ", "Race is reset");
				bot.guilds.get(zsrServerID).channels.get(zsrCommentaryChannelID).setTopic(" ", "Race is reset");
			}, 2000);

			_initOrResetRace(false, message);

			return;
		}
		else if (message.content.toLowerCase() === "!signup on") {
			if (discordRep.value.signupActive) {
				message.reply("Signups were already turned on!");
				return;
			}

			if (discordRep.value.raceSetup) {
				message.reply("You can't do this while a race is active!");
				return;
			}
			discordRep.value.signupActive = true;

			message.channel.setTopic("[OPEN] " + currentRun.value.longName + " " + currentRun.value.category + " Race (" + runners.value.length + " entrant(s))", "Race opens up registration");

			var postDate = JSON.parse(JSON.stringify(new Date()));
			var msec = Date.parse(currentRun.value.racetime);
			var racedate = new Date(msec);

			const embed = {
				"title": "**Race Signup is now open**",
				"description": "The next race will be a " + currentRun.value.name + " " + currentRun.value.category + " on " + racedate.toUTCString().replace("GMT","UTC") + "."
					+ "\n\nFeel free to participate using the following commands:"
					+ "```md\n[!enter gamename](Enters you into the race - replace gamename with your game (OoT3D, MM3D, TWWHD, TPHD))\n[!join commentary](Apply for commentary role)\n[!leave commentary](Remove commentary role)"
					+ "\n[!show profile](View your race profile)\n[!update profile](Updates your race profile)\n[!unregister](Deletes your Auth data and roles)```",
				"url": "https://discord.gg/" + currentRun.value.discord,
				"color": 16192000,
				"timestamp": postDate,
				"footer": {
					"icon_url": basePathAssets + "bot_iconotspm.png",
					"text": "Race created by ZSRBot"
				},
				"thumbnail": {
					"url": basePathIcon.concat(currentRun.value.shortName) + ".png"
				},
				"author": {
					"name": currentRun.value.name + " " + currentRun.value.category + " Race",
					"url": "https://speedrun.com/" + currentRun.value.srcom,
					"icon_url": basePathAssets + "ZSRLogo.png"
				},
				"image": {
					"url": basePathCover.concat(currentRun.value.shortName) + ".png"
				}
			};

			message.channel.send({ embed })
				.then(message => {
					message.pin();
				})
				.catch(error => log.info(error));
			if (currentRun.value.quali)
				message.channel.send("This is a qualification race. You need to participate in at least " + currentRun.value.qamount + " races to be eligible for the playoff brackets.");
			return;
		}
		else if (message.content.toLowerCase() === "!signup off") {
			if (!discordRep.value.signupActive) {
				message.reply("Signups were already turned off!");
				return;
			}

			discordRep.value.signupActive = false;

			message.channel.setTopic("[CLOSED] " + currentRun.value.longName + " " + currentRun.value.category + " Race (" + runners.value.length + " entrant(s))", "Race closes registration");

			message.reply("Signups are now turned off");

			return;
		}
		else if (message.content.toLowerCase().startsWith("!add runner ", 0) == true) {
			if (discordRep.value.raceHasStarted) {
				message.reply("Can't do this after the race has started!");
				return;
			}

			var runnerToAdd;

			if (message.mentions.members.size == 1)
				runnerToAdd = message.mentions.members.first();
			else {
				var discordTag = message.content.substr(12);

				if (discordTag.length < 3) {
					message.reply("No valid discord tag was provided!");
					return;
				}

				discordTag = discordTag.trim().replace("@", "");

				runnerToAdd = message.guild.members.find(member => {

					if (member.user.tag === discordTag)
						return true;

					return false;
				});

				if (!runnerToAdd) {
					message.reply("This runner could not be found! Has he joined the server and is the spelling correct?");
					return;
				}
			}

			enterRunner(message, runnerToAdd.user, runnerToAdd, true);

			return;
		}
		else if (message.content.toLowerCase().startsWith("!remove runner ", 0) == true) {
			if (discordRep.value.raceHasStarted) {
				message.reply("Can't do this after the race has started!");
				return;
			}

			var discordTag = "";

			if (message.mentions.users.size == 1)
				discordTag = message.mentions.users.first().tag;
			else {
				discordTag = message.content.substr(15);

				if (discordTag.length < 3) {
					message.reply("No valid discord tag was provided!");
					return;
				}

				discordTag = discordTag.trim().replace("@", "");
			}

			let foundRunner;
			let runnerIndex = 0;

			if (runners.value.length > 0) {
				foundRunner = runners.value.find(runner => {
					if (runner)
						if (runner.discord === discordTag)
							return true;

					runnerIndex++;

					return false;
				});
			}

			if (foundRunner) {
				runners.value.splice(runnerIndex, 1);

				var raceRoles = [zsrRaceEnteredID, zsrRaceReadyID, zsrRaceCommentaryID];

				if (message.guild.members.has(foundRunner.id))
					message.guild.members.get(foundRunner.id).removeRoles(raceRoles, "Member was removed from this race");

				message.reply("This runner was successfully removed from the upcoming race");
				return;
			}
			else {
				message.reply("This discord tag was not found in the list of active runners!");
				return;
			}
		}
	}

	//USER COMMANDS
	if (message.content.toLowerCase() === "!commands") {
		message.reply("[!enter | !join commentary | !leave commentary | !show profile | !update profile | !unregister]");
	}
	else if (message.content.toLowerCase().startsWith("!enter")) {
		if (!discordRep.value.signupActive) {
			message.reply("Signups are not accepted for the upcoming race at this time!");
			return;
		}

		let foundRunner;

		if (runners.value.length > 0) {
			foundRunner = runners.value.find(runner => {
				if (runner)
					if (runner.id === message.author.id)
						return true;

				return false;
			});
		}

		if (foundRunner) {

			message.reply("You already registered for this race! If you want to save your adjusted run profile please use *!update profile*");
			return;
		}

		enterRunner(message, message.author, message.member, false);
	}
		else if (message.content.toLowerCase() === "!join commentary") {
		if (!discordRep.value.signupActive) {
			message.reply("Signups are no longer accepted for the upcoming race!");
			return;
		}

		if (!message.member.roles.has(zsrRaceCommentaryID)) {
			message.member.addRole(zsrRaceCommentaryID);
			message.reply("Thank you for applying to commentate the upcoming race! The preliminary commentary role has been added to your profile");
		}
		else {
			message.reply("You already applied for commentary!");
		}
	}
	else if (message.content.toLowerCase() === "!leave commentary") {
		if (message.member.roles.has(zsrRaceCommentaryID)) {
			message.member.removeRole(zsrRaceCommentaryID);
			message.reply("We'll miss you! Your application for commentary and preliminary role has been removed");
		}
		else {
			message.reply("You haven't applied for commentary to begin with!");
		}
	}
	else if (message.content.toLowerCase() === "!show profile") {

		let foundRunner;

		if (runners.value.length > 0) {
			foundRunner = runners.value.find(runner => {
				if (runner)
					if (runner.id === message.author.id)
						return true;

				return false;
			});
		}

		if (!foundRunner) {

			message.reply("You have no race profile, because you are not registered for this race. To enter a race please use *!enter* during the registration period");
			return;
		}

		message.reply("This is how you will appear on our re-stream:\n\n**Registered Alias:** " + foundRunner.name + "\n**Registered Twitch Account:** twitch.tv/" + foundRunner.stream);
	}
	else if (message.content.toLowerCase() === "!unregister")
	{
		let foundRunner;

		if (runners.value.length > 0) {
			foundRunner = runners.value.find(runner => {
				if (runner)
					if (runner.id === message.author.id)
						return true;

				return false;
			});
		}

		if (foundRunner)
		{
			message.reply("You can not unregister yourself while you are still a part of an upcoming race!");
			return;
		}

		message.reply("You will be kicked from this channel in 20 seconds. Please revoke access to ZSRBot under Settings => Authorized Apps to complete deregistration!")
			.then(() => {

				setTimeout(() => {

					let file = path.resolve(process.env.NODECG_ROOT, 'db/registeredUsers.json');

					easyjson.path(file).del('users[' + message.author.id + ']');

					var raceRoles = [zsrRaceRegisteredID, zsrRaceEnteredID, zsrRaceReadyID, zsrRaceCommentaryID];

					raceRoles.forEach(role => {

						message.member.removeRole(role);
					});
				}, 20000);
			});
	}
	else if (message.content.toLowerCase() === "!update profile") {
		if (discordRep.value.raceHasStarted) {
			message.reply("This action can not be performed after the race has started!");
			return;
		}

		let foundRunner;

		if (runners.value.length > 0) {
			foundRunner = runners.value.find(runner => {
				if (runner)
					if (runner.id === message.author.id)
						return true;

				return false;
			});
		}

		if (!foundRunner) {

			message.reply("You are not registered for this race. To enter a race please use *!enter* during the registration period");
			return;
		}

		enterRunner(message, message.author, message.member, false);
	}
}

var voiceChannelConnection;

//COMMENTARY CHANNEL
function commentaryChannel(message) {
	//ADMIN COMMANDS
	if (message.member.hasPermission("MANAGE_CHANNELS")) {
		if (message.content.toLowerCase() === "!commands") {
			message.reply("ADMIN: [!clear | !bot join | !bot leave]");
			return;
		}
		else if (message.content.toLowerCase() === "!clear") {
			_clearChat(zsrCommentaryChannelID);
			return;
		}
		else if (message.content.toLowerCase() === "!bot join") {

			if (voiceChannelConnection) {
				message.reply("I already entered the commentary channel!");
				return;
			}

			voiceChannelConnection = bot.guilds.get(zsrServerID).channels.get(zsrVoiceCommentaryChannelID).join().then(connection => {

				voiceChannelConnection = connection;

				UpdateCommentaryChannelMembers();

				connection.on('speaking', (user, speaking) => {

					if (!voiceActivity.value.members || voiceActivity.value.members.length < 1)
						return;

					voiceActivity.value.members.find(voiceMember => {

						if (voiceMember.id == user.id) {
							voiceMember.isSpeaking = speaking; //delay this by streamleader delay/current obs timeshift delay if its activated with setTimeout
							return true;
						}

						return false;

					});
				});
			});

			return;
		}
		else if (message.content.toLowerCase() === "!bot leave") {

			if (!voiceChannelConnection) {
				message.reply("I'm not in the commentary channel!");
				return;
			}

			bot.guilds.get(zsrServerID).channels.get(zsrVoiceCommentaryChannelID).leave();

			voiceChannelConnection = null;
		}
	}
}

//RACE CHANNEL
function raceChannel(message) {
	//ADMIN COMMANDS
	if (message.member.hasPermission("MANAGE_CHANNELS")) {
		if (message.content.toLowerCase() === "!commands") {
			message.reply("ADMIN: [!clear | !race start | !race stop | !race finished]\nUSER: [!done | !undone | !quit]");
			return;
		}
		else if (message.content.toLowerCase() === "!clear") {
			_clearChat(zsrRaceChannelID);
			return;
		}
		else if (message.content.toLowerCase() === "!race start") {

			if (discordRep.value.raceFinished) {
				message.reply("A finished race can not be started again!");
				return;
			}

			if (discordRep.value.raceHasStarted) {
				message.reply("This race has already started!");
				return;
			}

			if (!discordRep.value.raceSetup) {
				message.reply("No race has been setup!");
				return;
			}

				discordRep.value.raceHasStarted = true;

				message.channel.send("ATTENTION", { tts: true })
					.then(() => {
						message.channel.send("<@&" + zsrRaceReadyID + ">")
							.then(() => {
								setTimeout(() => {

									if (!discordRep.value.raceHasStarted) //if the race is cancelled by the admin
										return;

									message.channel.send("```md\n#!!THIS RACE IS ABOUT TO START!!#\n```")
										.then(() => {

											_updateTopics(runners.value);

											setTimeout(() => {

												if (!discordRep.value.raceHasStarted) //if the race is cancelled by the admin
													return;

												let secondsLeft = 5;

												let timerID = setInterval(() => {

													if (!discordRep.value.raceHasStarted) //if the race is cancelled by the admin
													{
														clearInterval(timerID);
														return;
													}

													if (secondsLeft > 2) {
														message.channel.send("```diff\n-" + secondsLeft.toString() + "-\n```");
													}
													else if (secondsLeft > 0) {
														message.channel.send("```fix\n-" + secondsLeft.toString() + "-\n```");
													}
													else if (secondsLeft == 0) {
														clearInterval(timerID);

														message.channel.send("```xl\n\"GO\"\n```")
															.then(() => {

																if (!discordRep.value.raceHasStarted) //if the race is cancelled by the admin
																	return;

																discordRep.value.raceInProgress = true;	

																var timerDelay = twitchPlayer.value.streamLeaderDelay;

																leaderboard.value.forceStop = false;
																leaderboard.value.forceStart = true;
																leaderboard.value.forceDelay = Math.round(timerDelay / 1000);
																leaderboard.value.forceTime = 0;
															});
													}

													secondsLeft--;

												}, 2000);

											}, 5000);
										});
								}, 1000);
							});
					});
		}
		else if (message.content.toLowerCase() === "!race stop") {
			if (!discordRep.value.raceHasStarted) {
				message.reply("No race has been started that could be cancelled!");
				return;
			}

			if (discordRep.value.raceFinished) {
				message.reply("A finished race can not be stopped!");
				return;
			}

			discordRep.value.raceHasStarted = false;
			discordRep.value.raceInProgress = false;

			leaderboard.value.forceStop = true;
			leaderboard.value.forceStart = false;
			leaderboard.value.forceTime = 0;
			leaderboard.value.forceDelay = 0;

			leaderboard.value.ranking.length = 0;

			_updateTopics(runners.value);

			message.channel.send("The race in progress has been stopped by the stream manager!");

			return;
		}
		else if (message.content.toLowerCase() === "!race finished") {
			if (!discordRep.value.raceInProgress) {
				message.reply("No race has been started that could be finished!");
				return;
			}

			if (discordRep.value.raceFinished) {
				message.reply("A finished race can not be finished again!");
				return;
			}

			discordRep.value.raceFinished = true;

			//Set timer to last finished person's time
			var indexLastFinished = 0;

			leaderboard.value.forceStop = true;
			leaderboard.value.forceStart = false;
			leaderboard.value.forceDelay = 0;

			leaderboard.value.ranking.forEach(rank => {
				if (rank.status == "Finished")
					indexLastFinished++;
			});

			leaderboard.value.ranking.find(finishedRunner => {
				if (finishedRunner.place == indexLastFinished) {
					leaderboard.value.forceTime = finishedRunner.time;

					return true;
				}

				return false;
			});

			_updateTopics(runners.value);

			//Fail everyone who is still running
			if (leaderboard.value.ranking.length != runners.value.length)
			{
				runners.value.forEach(runner => {
					if (runner) {

						if (runner.state < 2)
						{
							runner.state = 3;

							runner.place = 0;
							runner.time = 0;
							runner.timeFormat = "Quit";

							log.info("New Runner " + runner.name + " Status: " + runner.state.toString() + " (Forfeited) Place: " + runner.place.toString() + " Time: " + runner.timeFormat.toString());

							leaderboard.value.ranking.push({
								name: runner.name,
								stream: runner.stream,
								status: "Forfeit",
								place: runner.place,
								time: runner.time,
								timeFormat: runner.timeFormat
							})
						}
					}
				});
			}

			message.channel.send("```md\n#!!THIS RACE HAS CONCLUDED!!#\n```")
				.then(() => {

					_postResults(message.channel);
				});

			return;
		}
	
	}
	//USER COMMANDS
	if (message.content.toLowerCase() === "!commands") {
		message.reply("[!done | !undone | !quit]");
	}
	else if (message.content.toLowerCase() === "!done") {
		if (discordRep.value.raceFinished || !discordRep.value.raceInProgress) {
			message.reply("You cannot perform this action right now!");
			return;
		}

		if (message.member.roles.has(zsrRaceEnteredID))
		{
			let foundRunner = runners.value.find(runner => {
				if (runner)
					if (runner.id === message.author.id)
						return true;

				return false;
			});

			if (foundRunner)
			{
				if (foundRunner.state == 1)
				{
					foundRunner.state = 2;
					if (foundRunner.slot < 1) {
						foundRunner.time = foundRunner.fullTime = stopwatch.value.raw;
						foundRunner.timeFormat = foundRunner.fullTimeFormat = stopwatch.value.formatted;
					} else {
						let prevRunner = runners.value.find(runner => {
							if (runner)
								if ((runner.team == foundRunner.team) && (runner.slot == (foundRunner.slot-1) && (runner.state == 2)))
								return true;
							return false;

						});
						if (!prevRunner) {
							message.reply("It's not your turn yet! Stop cheating :P");
							return;
						}
						let indivTime = stopwatch.value.raw - prevRunner.time
						foundRunner.time = indivTime;
						foundRunner.fullTime = stopwatch.value.raw;
						foundRunner.timeFormat = new Date(indivTime * 1000).toISOString().substr(11, 8);
						foundRunner.fullTimeFormat = stopwatch.value.formatted;
					};
					if (foundRunner.slot < 3)
						message.reply("Next runner for " + foundRunner.team +" can now start their run!");
					//Calc placement
					foundRunner.place = 0;

					leaderboard.value.ranking.forEach(finishedRunner => {
						if (finishedRunner.status === "Finished")
						{
							foundRunner.place++;
						}
					});

					foundRunner.place += 1;
					if (foundRunner.slot == 3) {
						let teamname;

						switch(foundRunner.team){
							case "Team 1":
								teamname = "The CoolCat Team";
							break;
							case "Team 2":
								teamname = "The B-Team";
							break;
							case "Team 3":
								teamname = "HD-Daddies";
							break;
							case "Team 4":
								teamname = "HD-Rumble";
							break;
						}
						leaderboard.value.ranking.push({
							name: teamname,
							status: "Finished",
							place: foundRunner.place,
							fullTime: foundRunner.fullTime,
							fullTimeFormat: foundRunner.fullTimeFormat
						});
						message.channel.send(teamname + " finished the relay race in " + foundRunner.place + (". place with a time of " + foundRunner.fullTimeFormat));
					}

					message.channel.send("```diff\n- " + foundRunner.name + " has finished " + foundRunner.game + " with a time of " + foundRunner.timeFormat + "! -```")
						.then(() => {
							//notify next runner via PM
							if (foundRunner.slot < 3) {
								_notifyRunner(foundRunner);
								//Switch Restream to next runner with 8 second delay
								nodecg.sendMessage("nextRunner", foundRunner);
							}
							//Check if race is done
							_raceDoneCheck(message.channel);
						});
				}
				else
				{
					message.reply("You already finished!");
				}
			}			
		}
		else {
			message.reply("You are not a part of this race!");
		}
	}
	else if (message.content.toLowerCase() === "!quit") {
		if (discordRep.value.raceFinished || !discordRep.value.raceInProgress)
		{
			message.reply("You cannot perform this action right now!");
			return;
		}

		if (message.member.roles.has(zsrRaceReadyID)) {
			let foundRunner = runners.value.find(runner => {
				if (runner)
					if (runner.id === message.author.id)
						return true;

				return false;
			});

			if (foundRunner)
			{
				if (foundRunner.state == 1)
				{
					foundRunner.state = 3;
					foundRunner.place = 0;
					foundRunner.time = 0;
					foundRunner.timeFormat = "Quit";

					log.info("New Runner " + foundRunner.name + " Status: " + foundRunner.state.toString() + " (Forfeited) Place: " + foundRunner.place.toString() + " Time: " + foundRunner.timeFormat.toString());
					if (foundRunner.slot == 3) {
						leaderboard.value.ranking.push({
							name: foundRunner.name,
							stream: foundRunner.stream,
							status: "Forfeit",
							place: foundRunner.place,
							time: foundRunner.time,
							timeFormat: foundRunner.timeFormat
						})
					}

					message.channel.send("```diff\n- " + foundRunner.name + " has forfeited from the race😢 -```")
						.then(() => {
							//Check if race is done
							_raceDoneCheck(message.channel);
						});
				}
				else
				{
					message.reply("You already finished!");
				}
			}
		}
		else
		{
			message.reply("You are not a part of this race!");
		}
	}
	else if (message.content.toLowerCase() === "!undone") {
		if (!discordRep.value.raceInProgress) {
			message.reply("You cannot perform this action right now!");
			return;
		}

		if (message.member.roles.has(zsrRaceEnteredID)) {
			let foundRunner = runners.value.find(runner => {
				if (runner)
					if (runner.id === message.author.id)
						return true;

				return false;
			});

			if (foundRunner)
			{
				if (foundRunner.state == 2 || foundRunner.state == 3)
				{
					foundRunner.state = 1;
					foundRunner.place = 0;
					foundRunner.time = 0;
					foundRunner.timeFormat = "";

					log.info("New Runner " + foundRunner.name + " Status: " + foundRunner.state.toString() + " (Undone) Place: " + foundRunner.place.toString() + " Time: " + foundRunner.timeFormat.toString());

					let index = 0;
					leaderboard.value.ranking.find(finishedRunner => {
						if (finishedRunner.stream == foundRunner.stream)
						{
							log.info("Runner " + foundRunner.name + " unfinished or unforfeited. Purge from ranking!");

							leaderboard.value.ranking.splice(index, 1);
							return true;
						}

						index++;

						return false;
					});

					//Re-calc all placements
					let finishedIndex = 1;

					leaderboard.value.ranking.forEach(finishedRunner => {
						if (finishedRunner.status === "Finished")
						{
							finishedRunner.place = finishedIndex;
							finishedIndex++;
						}
					});

					//Resume timer if the race was already finished
					if (discordRep.value.raceFinished)
					{
						discordRep.value.raceFinished = false;

						clearTimeout(raceConcludedGraceTimeout); //kill grace timer
						clearTimeout(raceConcludedTimerTimeout);

						_updateTopics(runners.value);

						if (stopwatch.value.state == "stopped")
						{
							const missedSeconds = Math.round((Date.now() - stopwatch.value.timestamp) / 1000);
							var timerDelay = twitchPlayer.value.streamLeaderDelay;

							leaderboard.value.forceStop = false;
							leaderboard.value.forceStart = true;
							leaderboard.value.forceDelay = Math.round(timerDelay / 1000);
							leaderboard.value.forceTime = stopwatch.value.raw + missedSeconds;
						}

						message.channel.send("```diff\n- This race is resuming due an undone! -\n```");
					}

					message.reply("You have withdrawn from your finished status!");
				}
				else
				{
					message.reply("You can't undone before you haven't finished or forfeited!");
				}
			}
		}
		else {
			message.reply("You are not a part of this race!");
		}
	}
	else if (message.content.toLowerCase() === "!ping")
	{
		message.reply('pong');	

		//message.reply(message.guild.roles.find("name", "Commentator").id);
	}
}

bot.on('message', message => {

	if (message.channel.id == zsrRaceChannelID) { //Race Channel
		raceChannel(message);
	}
	else if (message.channel.id == zsrCommentaryChannelID) { //Race Commentary Channel
		commentaryChannel(message);
	}
	else if (message.channel.id == zsrSignupChannelID) { //Race Signup Channel
		signupChannel(message);
	}
	else if (message.channel.name === "streams") {
		streamChannel(message);
	}
	else if (message.channel.name === "race-info")
	{
		if (message.content.toLowerCase() === "!intro")
		{
			var postDate = JSON.parse(JSON.stringify(new Date()));

			const embed = {
				"title": "**Introduction to the ZSR Discord Racing System**",
				"description": "Welcome to our ZSR Discord Racing System. After authenticating with ZSRBot you will be able to signup for upcoming community races.\rZSRBot will remember your auth data for future races and communicate with you via DMs and sticky posts inside our racing channels.",
				"url": "http://http://zelda.speedruns.com/race-signup",
				"color": 1619777,
				"timestamp": postDate,
				"footer": {
					"icon_url": basePathAssets + "bot_iconotspm.png",
					"text": "ZSRBot"
				},
				"thumbnail": {
                    "url": basePathAssets +"bot_iconotspm.png"
				},
				"image": {
					"url": "http://s3.amazonaws.com/zeldaspeedruns/var/app/current/public/system/images/1966/original/RacingSystem.png?1510619516"
				},
				"author": {
					"name": "Discord Racing System",
                    "icon_url": basePathAssets + "bot_iconotspm.png"
				},
				"fields": [
					{
						"name": "**__Signup:__**",
						"value": "Race signups and commentary applications take place in the #race-signup channel. The ZSR-Staff has to allow signups before you can enter a race. The current signup status and race info is visible in the channel title as soon as the signup was initially opened.\rAfter the authentication you have access to the following commands:"
					},
					{
						"name": "*!enter*:",
						"value": "Enters you into the race",
						"inline": true
					},
					{
						"name": "*!unenter*:",
						"value": "Removes you from the race",
						"inline": true
					},
					{
						"name": "*!join commentary*:",
						"value": "Apply for commentary",
						"inline": true
					},
					{
						"name": "*!leave commentary*:",
						"value": "Remove commentary role",
						"inline": true
					},
					{
						"name": "*!show profile*:",
						"value": "View your race profile data",
						"inline": true
					},
					{
						"name": "*!update profile*:",
						"value": "Update your race profile",
						"inline": true
					},
					{
						"name": "*!unregister*:",
						"value": "Deletes your Auth data",
						"inline": true
					},
					{
						"name": "*Note:*",
						"value": "Your twitch account needs to be linked to Discord under Settings => Connections to signup for races.\rThe nickname you have chosen for this server is displayed on our stream layout as your alias. If you change your twitch account or nickname **!update profile** pushes those changes to your existing race registration.\rOtherwise the old infomation present at signup time will be used instead."
					},
					{
						"name": "**__Race:__**",
						"value": "Once the race is set up, you will get access to the #race-channel. Once everybody is ready and the race is started, you will get a tts notification by the bot and the countdown will start. \rTimekeeping will be handled in this channel as well. You can use the following commands:"
					},
					{
						"name": "*!ready*:",
						"value": "Be ready to start",
						"inline": true
					},
					{
						"name": "*!unready*:",
						"value": "Revokes your ready status",
						"inline": true
					},
					{
						"name": "*!done*:",
						"value": "Notifies the bot that you finished your run - this will inform the next runner in your team to start their run!",
						"inline": true
					},
					{
						"name": "*!undone*:",
						"value": "Withdraw from !done. The time you were paused is accounted for",
						"inline": true
					},
					{
						"name": "*!quit*:",
						"value": "Used to forfeit the race if needed (try to avoid this)",
						"inline": true
					},
					{
						"name": "**__Streaming Guidelines:__**",
						"value": "Streaming on Twitch is required to participate in ZSR community races.\rYour stream will be picked up by the restream frequently while showing your name and your Twitch account next to your stream window.\rTo enable us to restream your gameplay properly, please stream with your gamefeed fullscreen and centered on the screen without anything above it (timers, alerts, ads).\r\rStretching will cause the restream to cut off parts of your gamefeed, so streaming in the correct aspect ratio (4:3, 16:9, 10:9 (GB & GBC), 3:2 (GBA), 5:3 (3DS) is required. You can find layout images that show the correct gamefeed placement at <https://imgur.com/a/9EqgC>\r\rTo be able to put out pure game audio to the viewers it is necessary that all participants mute their microphone and other audio sources except for the actual game feed on stream."
					}
				]
			};
			message.channel.send({ embed })
			.then(message => {

				message.pin();
			})
			.catch(error => log.info(error));
		}
	}
});

function enterRunner(message, userObj, memberObj, adminAdd) {
	let file = editJsonFile(path.resolve(process.env.NODECG_ROOT, 'db/registeredUsers.json'));

	var userAccessToken = file.get("users." + userObj.id + ".accessToken");
	var userRefreshToken = file.get("users." + userObj.id + ".refreshToken");
	if (!userAccessToken) {
		if (!adminAdd)
			message.reply("Your discord auth data was lost or you landed here by accident. Please repeat the auth process before attempting to enter: " + zsrDiscordAuthLink);
		else
			message.reply("This user has not registered yet. Please ensure he completes the auth process before attempting to enter him: " + zsrDiscordAuthLink);

		return;
	}

	request({
		url: 'http://discordapp.com/api/users/@me',
		method: 'get',
		auth: {
			'bearer': userAccessToken
		}
	}, function (err, res) {
		//console.log(err + " " + res.body);

		if (res.body.includes("401: Unauthorized") || res.body.includes("403: Forbidden")) {
			var TokenProvider = require('refresh-token');

			var tokenProvider = new TokenProvider('https://discordapp.com/api/oauth2/token', {
				refresh_token: userRefreshToken,
				client_id: '376027907803447296',
				client_secret: 'cQ9YDOXho8MwZTL2qLzliNHYZVmJ9gyF'
			});

			tokenProvider.getToken(function (err, token) {
				//console.log(err + " token: " + token);

				if (!token || err && err.includes("invalid_grant")) {

					if (!adminAdd)
						message.reply("You revoked ZSRBot's access or your discord auth key became invalid. Please repeat the auth process before entering a race: " + zsrDiscordAuthLink);
					else
						message.reply("This user's access token became invalid or he revoked ZSRBot's access. Please ensure he redoes the auth process before attempting to enter him: " + zsrDiscordAuthLink);

					return;
				}

				file.set("users." + userObj.id + ".accessToken", token);
				file.save();

				addRunnerToRace(message, userObj, memberObj, token, adminAdd);
			});
		}
		else {
			addRunnerToRace(message, userObj, memberObj, userAccessToken, adminAdd);
		}
	});
}

function addRunnerToRace(message, userObj, memberObj, accessToken, adminAdd) {
	request({
		url: 'http://discordapp.com/api/users/@me/connections',
		method: 'get',
		auth: {
			'bearer': accessToken
		}
	}, function (err, res) {
		//console.log(err + " " + res.body);

		if (res.body.includes("401: Unauthorized") || res.body.includes("403: Forbidden") || !res.body.includes("[")) {
			if (!adminAdd)
				message.reply("Critical error, please repeat the discord authorization here: " + zsrDiscordAuthLink);
			else
				message.reply("Critical error, please make the runner repeat the discord authorization here: " + zsrDiscordAuthLink);

			return;
		}

		let linkedAccounts = JSON.parse(res.body);

		if (linkedAccounts.length == 0) {
			if (!adminAdd)
				message.reply("Please link a twitch account to discord before attempting to enter a race!");
			else
				message.reply("The runner has to link a twitch account to discord before he can enter this race!");

			return;
		}

		var twitch = linkedAccounts.find(account => {

			if (account.type === "twitch")
				return true;

			return false;
		})

		if (!twitch) {
			if (!adminAdd)
				message.reply("Please link a twitch account to discord before attempting to enter a race!");
			else
				message.reply("The runner has to link a twitch account to discord before he can enter this race!");

			return;
		}

		if (twitch.revoked || !twitch.verified) {
			if (!adminAdd)
				message.reply("Your linked twitch account was not verfied or access was revoked . Please re-link your twitch account to discord!");
			else
				message.reply("The runner's linked twitch account was not verfied or access was revoked. He needs to re-link his twitch account to discord!");

			return;
		}

		let foundRunner;
		
		if (runners.value.length > 0) {
			foundRunner = runners.value.find(runner => {
				if (runner)
					if (runner.id === userObj.id)
						return true;

				return false;
			});
		}

		//Add runner to list or update him if found
		if (foundRunner) {
			
			if (!adminAdd)
				message.reply("Changes in your profile have been recorded");
			else
				message.reply("Runner already has entered this race, but any changes in his profile have been recorded");

			foundRunner.name = memberObj.displayName;
			foundRunner.stream = twitch.name;
			foundRunner.discord = userObj.tag;
		}
		else {
			let gameName;
			if (adminAdd) {
				gameName = message.content.split(" ")[3];
			}
			else {
				gameName = message.content.split(" ")[1];
			}
			if (gameName == undefined) {
				message.reply("You didn't specify a game!")
				return;
			}
			let roleIDs = ["244954316266274816", "244954321152770069", "244954323501580298", "244954325116387329"];
			let team;
			
			let slot;
			switch(gameName.toLowerCase()) {
				case "oot3d":
					slot = 0;
				break;
				case "mm3d":
					slot = 1;
				break;
				case "twwhd":
					slot = 2;
				break;
				case "tphd":
					slot = 3;
				break;
			}
			for (var i = 0; i <= 4; i++) {
				if (message.member.roles.has(roleIDs[i]))
				team = "Team " + (i+1);
			}
			if (adminAdd)
				team = message.content.split(" ")[4] + " " + message.content.split(" ")[5]; 

			var teamArray = {};
			var playerArray = {
				id: userObj.id,
				name: memberObj.displayName,
				stream: twitch.name,
				discord: userObj.tag,
				game: gameName,
				team: team,
				slot: slot,
				state: 1, //0 = unready, 1 = ready, 2 = done, 3 = forfeited
				place: 0,
				time: 0,
				fullTime: 0,
				timeFormat: "",
				fullTimeFormat: ""
			};
			 
			if (!adminAdd) {
				if (!message.member.roles.some(r=>roleIDs.includes(r.id))) {
					message.reply("You are not part of a relay team!");
					return;
				}
				message.reply("You entered the relay race successfully as part of " + team);
			} else {
				if (!message.member.roles.some(r=>roleIDs.includes(r.id))) {
					message.reply("This runner is not part of a relay team!");
					return;
				}
				message.reply("Runner was added to the race successfully as part of " + team);
			}
			var teamIndex = parseInt(team.split(" ")[1]) -1;
			log.info("Player joined " + team);
			if (runners.value.length == 0) {
				runners.value = [];

				runners.value[0] = {

					id: userObj.id,
					name: memberObj.displayName,
					stream: twitch.name,
					discord: userObj.tag,
					team: team,
					game: gameName,
					slot: slot,
					state: 1, //0 = unready, 1 = ready, 2 = done, 3 = forfeited
					place: 0,
					time: 0,
					fullTime: 0,
					timeFormat: "",
					fulltimeFormat: ""
				};
			}
			else {
				runners.value.push({

					id: userObj.id,
					name: memberObj.displayName,
					stream: twitch.name,
					discord: userObj.tag,
					team: team,
					game: gameName,
					slot: slot,
					state: 1,
					place: 0,
					time: 0,
					fullTime: 0,
					timeFormat: "",
					fulltimeFormat: ""
				});
			}
			if (teams.value.teams.length == 0) {

				teamArray[teamIndex] = {
					teamname: team,
					id: teamIndex,
					runners: []
				};
				teamArray[teamIndex].runners.push(playerArray);
				
				teams.value.teams.push(teamArray[teamIndex]);
			}
			else {
				if (teams.value.teams[teamIndex] === undefined) {
					
					teamArray[teamIndex] = {
						teamname: team,
						id: teamIndex,
						runners: []
					};
					teamArray[teamIndex].runners.push(playerArray);
					teams.value.teams.push(teamArray[teamIndex]);
					_sortTeams();
				} else if (teamIndex != (teams.value.teams[teamIndex].id)) {
					teamArray[teamIndex] = {
						teamname: team,
						id: teamIndex,
						runners: []
					};
					teamArray[teamIndex].runners.push(playerArray);
					teams.value.teams.push(teamArray[teamIndex]);
					_sortTeams();
				} else {	
					teams.value.teams[teamIndex].runners.push(playerArray);
					_sortRunners(teamIndex);
				}
			}

			var x = 0;

			/*
			//TEST
			while (x < 30) {
				runners.value.push({
					id: userObj.id,
					name: memberObj.displayName,
					stream: twitch.name,
					discord: userObj.tag,
					state: 0,
					place: 0,
					time: 0,
					timeFormat: ""
				});
				x++;
			}
			leaderboard.value.ranking.push({ name: "haha", stream: "lol", status: "finishd", place: 0, timeFormat: "hu" });
			*/
		}

		if (discordRep.value.raceSetup) //Check if roles need updating if race is already started
		{
			if (!memberObj.roles.has(zsrRaceEnteredID) && !memberObj.roles.has(zsrRaceReadyID))
				memberObj.addRole(zsrRaceEnteredID, "Runner joined late");
		}
	});
}
function _sortRunners(index)
{
	var ordering = {};
	var sortOrder = ['oot3d', 'mm3d', 'twwhd', 'tphd'];
	for (var i=0; i<sortOrder.length; i++)
		ordering[sortOrder[i]] = i;
	if (teams.value.teams[index].runners.length > 1) {
		teams.value.teams[index].runners.sort(function(a, b) {
			log.info(a.game.toLowerCase() + " " + b.game.toLowerCase());
			return (ordering[a.game.toLowerCase()] - ordering[b.game.toLowerCase()]);
		});
	}
}

function _sortTeams()
{
	if (teams.value.teams.length > 1) {
		teams.value.teams.sort(function(a,b) {
			if (a.id > b.id) {
				return 1;
			}
			if (a.id < b.id) {
				return -1;
			}
			// a muss gleich b sein
			return 0;
			});
	}
}
nodecg.listenFor('clearRaceChat', _clearChat);

function _clearChat(textChannelID) {
	let channel = bot.channels.get(textChannelID);

	log.info("Fetch messages");

	channel.fetchMessages({ limit: 99 })
		.then(messages => {
			if (messages.size > 2) {
				channel.bulkDelete(messages, false)
					.then(() => {

						log.info("Removed " + messages.size + " messages");

						_clearChat(textChannelID);
					});
			}
			else if (messages.size > 0) {

				log.info("Remove final " + messages.size + " messages");

				Array.from(messages.values()).forEach(message => {

					message.delete();
				});
			}
			else {
				log.info("No more messages left");
			}
		})
		.catch(error => log.info(error));
}

nodecg.listenFor('initRace', _initOrResetRace);

function _initOrResetRace(isInit, message) {

	if (isInit == true)
		log.info("Init Race");
	else
		log.info("Reset Race");

	bot.guilds.get(zsrServerID).fetchMembers()
		.then(guild => {

			log.info("Finished member fetching for server: " + guild.name + " Total members: " + guild.memberCount);

			if (isInit)
				_initRace(guild, message);
			else
				_resetRace(guild, message);
		})
		.catch(error => {

			log.info("Fetch error: " + error);
		});

	bot.on('guildMembersChunk', members => {
		if (members.length > 0) {
			log.info("Members in this chunk: " + members.length);
		}
		else {
			log.info("No more members, abort");
		}
	});
}

function _initRace(guild, message) {
	if (discordRep.value.raceSetup) //race is setup, update roles only
	{
		runners.value.forEach(runner => {
			if (runner) {

				if (guild.members.has(runner.id)) {
					let participant = guild.members.get(runner.id);

					if (runner.status == 0 && !participant.roles.has(zsrRaceEnteredID) && !participant.roles.has(zsrRaceReadyID))
						participant.addRole(zsrRaceEnteredID, "Runner joined late");
				}
			}
		});

		return;
	}

	//Setup Race
	discordRep.value.raceSetup = true;

	var missingMembers = [];
	var offlineMembers = [];
	var raceMembers = [];

	runners.value.forEach(runner => {
		if (runner) {

			if (guild.members.has(runner.id)) {
				let participant = guild.members.get(runner.id);

				participant.addRole(zsrRaceEnteredID, "Race is setup");

				if (participant.presence.status === "offline" || participant.presence.status === "dnd") {
					log.info(runner.name + " [twitch.tv/" + runner.stream + " ; " + runner.discord + "] is offline or set to busy!");
					offlineMembers.push(runner);
				}

				raceMembers.push(runner);
			}
			else {
				log.info(runner.name + " [twitch.tv/" + runner.stream + " ; " + runner.discord + "] is no longer in the ZSR server!");
				missingMembers.push(runner);
			}
		}
	});

	var adminMessage = "";

	if (missingMembers.length > 0 || offlineMembers.length > 0)
		adminMessage = "**" + currentRun.value.name + " " + currentRun.value.category + " Race**\n\n";

	if (missingMembers.length > 0) {
		adminMessage = adminMessage.concat("The following members registered for the race, but are not in the ZSR Server anymore: ");

		let first = true;

		missingMembers.forEach(runner => {

			if (!first)
				adminMessage = adminMessage.concat(", ");

			first = false;

			adminMessage = adminMessage.concat(runner.name + " [twitch.tv/" + runner.stream + " ; " + runner.discord + "]");
		});

		adminMessage = adminMessage.concat("\n");
	}

	if (offlineMembers.length > 0) {

		adminMessage = adminMessage.concat("The following members are fully registered, but currently offline or set to busy: ");

		let first = true;

		offlineMembers.forEach(runner => {

			if (!first)
				adminMessage = adminMessage.concat(", ");

			first = false;

			adminMessage = adminMessage.concat(runner.name + " [twitch.tv/" + runner.stream + " ; " + runner.discord + "]");
		});

		adminMessage = adminMessage.concat("\n");
	}

	if (adminMessage.length > 0) {
		adminMessage = adminMessage.concat("\nPlease contact them to make sure everyone is ready soon!");

		message.author.send(adminMessage);
	}

	var raceChannel = guild.channels.get(zsrRaceChannelID);
	var commentaryChannel = guild.channels.get(zsrCommentaryChannelID);

	//Set initial topic
	raceChannel.setTopic("[WAITING] " + currentRun.value.longName + " " + currentRun.value.category + " Race (" + "0/" + runners.value.length + " Ready)", "Race is setup");

	setTimeout(() => {
		let raceName = currentRun.value.name;

		if (!currentRun.value.name.toLowerCase().startsWith("the")) {
			raceName = "The " + currentRun.value.name;
		}

		var embed = {
			"description": "<@&" + zsrRaceEnteredID + "> **Starting soon: " + raceName + " " + currentRun.value.category + " Race**\n\nPlease use the following commands at your discretion:```md\n[!done](As soon as you finish - this will inform the next runner in your team to start their run)\n[!undone](If you made a mistake)\n[!quit](In case you cannot finish your run)```Happy Racing!!",
			"url": "https://speedrun.com/" + currentRun.value.srcom,
			"color": 16192000,
			"thumbnail": {
				"url": basePathIcon.concat(currentRun.value.shortName) + ".png"
			}
		};

		raceChannel.send({ embed })
			.then(message => {

				message.pin();
			})
			.catch(error => log.info(error));

		embed = {
			"title": "Commentary Guidelines",
			"description": "We have a few rules and guidelines for commentators to guarantee a pleasant viewing experience on our Twitch stream.",
			"url": "https://zsr-nodecg.eu:9090/bundles/external-assets/graphics/commentary_relay.html",
			"color": 1634359,
			"footer": {
				"icon_url": basePathAssets + "bot_iconotspm.png",
				"text": "Commentary Guidelines for ZSR Races"
			},
			"thumbnail": {
				"url": basePathIcon.concat(currentRun.value.shortName) + ".png"
			},
			"fields": [
				{
					"name": "__Rundown:__",
					"value": "The stream manager will get in contact with you roughly 30 minutes before the race starts and ask you to join the #Commentary voice channel.\nPlease be available at that time to test audio and balance your microphone volume.\nOnce the race is about to start, the stream manager/host will give a quick introduction on stream before handing it over to you.\nEvery further information during the race will be given in the #race-commentary channel, so make sure to check this channel frequently."
				},
				{
					"name": "__Microphone Settings:__",
					"value": "Make sure to provide a decently high volume level to Discord. If you can not rule out loud background noise like mechanical keyboard hits or other loud noise in your environment, please use push to talk."
				},
				{
					"name": "__Runners on Stream:__",
					"value": "You have access to a special Commentary page that updates the currently shown runners automatically and also provides you with the ZSR Twitch chat. Please make sure to commentate off this page to ensure you will be synced with the restream:\n https://zsr-nodecg.eu/bundles/external-assets/graphics/commentary_relay.html \n Please adjust the page to your preferred size and then reload. The streams and twitch chat will adjust their size."
				},
				{
					"name": "__General Rules:__",
					"value": "Once the race starts, introduce yourself and try to give some basic information about the run. \nAs the run goes on, try to occasionally focus on all runners on stream, not just the leader.\nTry to keep the discussion mainly on-topic and about the game. This doesn't mean you cannot have fun! We want you to be as entertaining as you can.\n\nIf anything exceedingly inappropriate is said during your commentary (Racism, extreme sexism etc.) you will removed from the voice channel and banned from participating in future ZSR events."
				}
			]
		};

		commentaryChannel.send("<@&" + zsrCommentatorID + "> Welcome Commentators! Thank you for contributing to this race", { embed })
			.then(message => {			
				message.pin();
			})
			.catch(error => log.info(error));

		raceMembers.forEach(runner => {
			if (runner.slot == 0)
			guild.members.get(runner.id).send("🔔🏁\nHey there " + runner.name + ". You have registered for " + "**" + raceName + " " + currentRun.value.category + " Race** which is about to begin and you are the first runner of your team!\nPlease head into the 👉<#376157053653221397> now and ready up 😀");

		});

	}, 10000);

	message.reply("The race was setup correctly! Sending out notifications in 10 seconds...");
}

function _resetRace(guild, message) {
	//Remove all race specific roles from all members
	var raceRoles = [zsrRaceEnteredID, zsrRaceReadyID, zsrRaceCommentaryID];

	raceRoles.forEach(role => {

		Array.from(guild.roles.get(role).members.values()).forEach(member => {

			member.removeRole(role);
		});

	});

	message.reply("The race was reset successfully. Please wait 1 minute for all role deletions to be processed");
}

function _updateTimerTopic(newTimer) {
	bot.guilds.get(zsrServerID).channels.get(zsrRaceChannelID).setTopic("[RUNNING - " + newTimer.formatted + "] " + raceTopic, "Title Update");
}

function _updateTopics(runnerVal) {
	if (!runnerVal)
		return;

	var statusSignup = "[CLOSED]";
	var statusRace = "[WAITING]";
	var statusCommentary = " ";

	if (discordRep.value.signupActive)
		statusSignup = "[OPEN]";

	if (discordRep.value.raceSetup) {
		statusCommentary = "[IN PROGRESS]";
		statusSignup = "[IN PROGRESS]";
	}

	if (discordRep.value.raceHasStarted)
		statusRace = "[RUNNING]";

	if (discordRep.value.raceInProgress)
		statusRace = "[RUNNING - ";

	if (discordRep.value.raceFinished) {
		statusSignup = "[FINISHED]";
		statusCommentary = "[FINISHED]";
		statusRace = "[FINISHED - ";
	}

	//Signup Channel
	bot.guilds.get(zsrServerID).channels.get(zsrSignupChannelID).setTopic(statusSignup + " " + currentRun.value.longName + " " + currentRun.value.category + " Race (" + runnerVal.length + " entrant(s))", "Title Update");

	//Commentary Channel
	bot.guilds.get(zsrServerID).channels.get(zsrCommentaryChannelID).setTopic(statusCommentary + " " + currentRun.value.longName + " " + currentRun.value.category + " Race", "Title Update");

	if (runnerVal.length > 0) {
		if (discordRep.value.raceFinished) {
			let finishedCount = runnerVal.filter(function (runner) {
				if (runner.state < 2)
					return false;
				else
					return true;
			}).length;

			bot.guilds.get(zsrServerID).channels.get(zsrRaceChannelID).setTopic(statusRace + stopwatch.value.formatted + "] " + currentRun.value.longName + " " + currentRun.value.category + " Race", "Title Update");
		}
		else if (discordRep.value.raceInProgress) {
			let finishedCount = runnerVal.filter(function (runner) {
				if (runner.state < 2)
					return false;
				else
					return true;
			}).length;

			raceTopic = currentRun.value.longName + " " + currentRun.value.category + " Race (" + finishedCount + "/" + runnerVal.length + " Done)";

			bot.guilds.get(zsrServerID).channels.get(zsrRaceChannelID).setTopic(statusRace + stopwatch.value.formatted + "] " + raceTopic, "Title Update");
		}
		else if (discordRep.value.raceHasStarted) {
			let finishedCount = runnerVal.filter(function (runner) {
				if (runner.state < 2)
					return false;
				else
					return true;
			}).length;

			raceTopic = currentRun.value.longName + " " + currentRun.value.category + " Race (" + finishedCount + "/" + runnerVal.length + " Done)";

			bot.guilds.get(zsrServerID).channels.get(zsrRaceChannelID).setTopic(statusRace + " " + raceTopic, "Title Update");
		}
		else if (discordRep.value.raceSetup) {
			let readiedUpCount = runnerVal.filter(function (runner) {
				if (runner.state == 0)
					return false;
				else
					return true;
			}).length;

			//log.info("ready up count: " + readiedUpCount.toString());

			bot.guilds.get(zsrServerID).channels.get(zsrRaceChannelID).setTopic(statusRace + " " + currentRun.value.longName + " " + currentRun.value.category + " Race (" + readiedUpCount + "/" + runnerVal.length + " Ready)", "Title Update");
		}
	}
}

function _notifyRunner(finishedRunner)
{
	let nextRunner = runners.value.find(runner => {
		if (runner)
			if ((finishedRunner.team == runner.team) && (finishedRunner.slot == (runner.slot-1)))
				return true;	
		return false;
	});
	bot.guilds.get(zsrServerID).members.get(nextRunner.id).send("GOGOGO! Your teammate just finished! Remember to enter !done as soon as possible after you finished your run as it determines when your teammate is allowed to start!");
}

function _raceDoneCheck(channel)
{
	if (leaderboard.value.ranking.length >= 4)
	{
		discordRep.value.raceFinished = true;

		//Timer Stop after leader delay (=last person running) and adjust time to final streamers time and remove the delay
		raceConcludedTimerTimeout = setTimeout(() => {

			if (!discordRep.value.raceFinished || !discordRep.value.raceInProgress)
				return;

			leaderboard.value.forceStop = true;
			leaderboard.value.forceStart = false;
			leaderboard.value.forceDelay = 0;

			var indexLastFinished = 0;

			leaderboard.value.ranking.forEach(rank => {
				if (rank.status == "Finished")
					indexLastFinished++;
			});

			leaderboard.value.ranking.find(finishedRunner => {
				if (finishedRunner.place == indexLastFinished) {
					leaderboard.value.forceTime = finishedRunner.time;

					return true;
				}

				return false;
			});

		}, twitchPlayer.value.streamLeaderDelay);


		//Result Post
		_updateTopics(runners.value);

		raceConcludedGraceTimeout = setTimeout(() => {

			channel.send("```md\n#!!THIS RACE HAS CONCLUDED!!#\n```")
				.then(() => {
					if (!discordRep.value.raceFinished || !discordRep.value.raceInProgress)
						return;

					raceConcludedGraceTimeout = setTimeout(() => {

						if (!discordRep.value.raceFinished || !discordRep.value.raceInProgress)
							return;

						_postResults(channel);

					}, 15000);

				});

		}, 1000);
	}
}

function _postResults(channel)
{
	discordRep.value.raceInProgress = false; //lock every other command from now on
	resultSnap.value.takeSnap = true;
	var screenshotdelay;
	resultSnap.on('change', newVal => {

		if (!newVal)
			return;
			screenshotdelay = setTimeout(() => {
				if (newVal.snapSuccess)
				{
					newVal.snapSuccess = false;

					var postDate = JSON.parse(JSON.stringify(new Date()));

					var msec = Date.parse(currentRun.value.racetime);
					var racedate = new Date(msec);
					const embed = {
						"title": currentRun.value.name + " - " + currentRun.value.category + " on " + racedate.toUTCString().replace("GMT","UTC"),
						"url": "http://zelda.speedruns.com/relay-results",
						"color": 1369976,
						"timestamp": postDate,
						"footer": {
							"icon_url": basePathAssets + "bot_iconotspm.png",
							"text": "This race was managed by ZSRBot"
						},
						"thumbnail": {
							"url": basePathIcon.concat(currentRun.value.shortName) + ".png"
						},
						"image": {
							"url": basePathAssets.concat("results/relay/" + currentRun.value.shortName + "_" + racedate.getUTCFullYear().toString()) + ".png"
						},
						"author": {
							"name": "Relay Results:",
							"url": "http://zelda.speedruns.com/relay-results",
							"icon_url": basePathAssets + "ZSRLogo.png"
						}
					};
					channel.send({ embed })
						.then(() => {

							setTimeout(() => {
								//channel.send("The current relay standings can be found over at http://zelda.speedruns.com/relay-results");
								channel.send("Thanks to all the runners for participating in this relay race on ZSR. Hope to see you all again next event!");	
							}, 3000);	
						});
				}	
			}, 5000);
	});
	
	if (testMode)
		return;
	/*
	//Write new race result into standings.json
	let standingsPath = path.resolve(process.env.NODECG_ROOT, 'bundles/external-assets/graphics/img/results/relay/results.json');
	let json = editJsonFile(standingsPath);
	if (json.length == 0){
		json.set("relayrace", [{
			results: [],
		}]);
	}	
		let tournament = json.get("relayrace");
	
	if (relayrace[0].length == 0) {
		relayrace[0].results = [];

	}

	let resultPage = relayrace[0].results;

	//Prettyfy results
	var archiveRanking = [];


	leaderboard.value.ranking.forEach(finishedRunner => {

	if ((finishedRunner.status === "Finished") && (finishedRunner.slot == 3))
		archiveRanking.push({team: finishedRunner.team, status: finishedRunner.status, fullTime: finishedRunner.fullTime, fullTimeFormat: finishedRunner.fulltimeFormat});
	});

	//Quitters last
	leaderboard.value.ranking.forEach(finishedRunner => {

	if (finishedRunner.status === "Forfeit")
		archiveRanking.push({team: finishedRunner.team, stream: finishedRunner.stream, status: "Forfeit", place: "-", fulltimeFormat: "	" });
	});

	relayrace[0].results.push(archiveRanking);


	json.set("relayrace", relayrace);
	json.save();
	log.info("relay stats updated!");
	emitter.eventBus.sendEvent('raceFinished');	
	*/	
}

nodecg.listenFor('assignmentsChanged', _assignmentsChanged);

function _assignmentsChanged(kadgarLink)
{
	if (!botIsReady || !discordRep.value.raceSetup || discordRep.value.raceFinished)
		return;

	var timeStamp = new Date();

	bot.guilds.get(zsrServerID).channels.get(zsrCommentaryChannelID).send("[" + timeStamp.toLocaleTimeString() + "] 👁 The featured runners were changed to: " + kadgarLink);
}

bot.login(zsrBotToken);

		/*
		for (var key2 in key)
		{
			log.info(key2 + ": " + key[key2]);
		}
		*/

//bot.servers[ServerID].channels[VoiceChannelID].members
//244939773121265664
