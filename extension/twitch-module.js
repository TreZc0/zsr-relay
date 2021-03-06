'use strict';

// Ours
const nodecg = require('./util/nodecg-api-context').get();
const obs = require('./obs');

// Native
const fs = require('fs');
const path = require('path');

const twitchPlayer = nodecg.Replicant('twitchPlayer', {defaultValue: {}, persistent: true});
const nextGame = nodecg.Replicant('currentRun');
const runners = nodecg.Replicant('runners');
const teams = nodecg.Replicant('teams');
const log = new nodecg.Logger(`${nodecg.bundleName}:twitch-module`);
const schedule = nodecg.Replicant('schedule');
const twitchStreams = require('twitch-get-stream')('dpmtphrmjeqjql0pqve1zobu1fpomv'); // twitch now ENFORCES client id usage apparently, so this is now required and needs to be replaced with your client id
const hls = require("hls-live-thumbnails");

nodecg.listenFor('askChangePlayer', _askChangeRun);
nodecg.listenFor('askSwitchRunners', _askSwitchRunners);
nodecg.listenFor('askReloadLayoutConfig', _askReloadLayoutConfig);
nodecg.listenFor('takeStreamSnapshot', _takeStreamSnapshot);

var currentRunInfo;
var thumbGenerator;

var initialLayoutFileLoaded = false;

const snapPath = path.resolve(process.env.NODECG_ROOT, `bundles/${nodecg.bundleName}/graphics/img/streamSnaps`);

twitchPlayer.value =
{
	layoutSetup: {},
	runnerList: [],
	team1: [],
	team2: [],
	team3: [],
	team4: [],
    playerInstanceCreated: false,
    streamAURL: "trezalt2",
    streamBURL: "trezalt2",
    streamCURL: "trezalt2",
    streamDURL: "trezalt2",
    streamAMuted: false,
    streamBMuted: false,
    streamCMuted: false,
    streamDMuted: false,
    streamARunning: false,
    streamBRunning: false,
    streamCRunning: false,
    streamDRunning: false,
    streamAPaused: false,
    streamBPaused: false,
    streamCPaused: false,
    streamDPaused: false,
    streamAVolume: 0.5,
    streamBVolume: 0.5,
    streamCVolume: 0.5,
    streamDVolume: 0.5,
    streamADelay: 0,
    streamBDelay: 0,
    streamCDelay: 0,
    streamDDelay: 0,
	streamLeaderDelay: 0,
	streamAWidth: 0,
	streamBWidth: 0,
	streamCWidth: 0,
	streamDWidth: 0,
	streamAHeight: 0,
	streamBHeight: 0,
	streamCHeight: 0,
	streamDHeight: 0,
	streamALeft: 0,
	streamBLeft: 0,
	streamCLeft: 0,
	streamDLeft: 0,
	streamATop: 0,
	streamBTop: 0,
	streamCTop: 0,
	streamDTop: 0
};

function _askReloadLayoutConfig() {
	const layoutFilePath = path.resolve(process.env.NODECG_ROOT, 'twitchPlayerSetup.json');
	const layoutFileExists = fs.existsSync(layoutFilePath);

	if (layoutFileExists) {
		const rawLayoutFile = fs.readFileSync(layoutFilePath, 'utf8');

		let layoutFile;
		try {
			layoutFile = JSON.parse(rawLayoutFile);
		} catch (e) {
			throw new Error(`Failed to parse ${layoutFilePath}. Please ensure that it contains only valid JSON.`);
		}

		if (layoutFile) {
			twitchPlayer.value.layoutSetup = layoutFile;

			log.info("Twitch Player Layout file parsed/updated!");

			if (initialLayoutFileLoaded)
				_setPlayerDefaults(nextGame.value);

			initialLayoutFileLoaded = true;
		}
	}
	else {
		throw new Error("Twitch Player Layout file could not be found!");
	}
}

_askReloadLayoutConfig();

runners.on('change', newVal => { //this is probably called too often and should be changed

	if (!newVal)
		return;

	if (twitchPlayer.value.runnerList.length > 0)
		twitchPlayer.value.runnerList.length = 0;

	if ((twitchPlayer.value.team1.length > 0) || (twitchPlayer.value.team2.length > 0) || (twitchPlayer.value.team3.length > 0) || (twitchPlayer.value.team4.length > 0)) {
		twitchPlayer.value.team1.length = 0;
		twitchPlayer.value.team2.length = 0;
		twitchPlayer.value.team3.length = 0;
		twitchPlayer.value.team4.length = 0;
	}
	if (newVal.length > 0) {
		newVal.forEach(runner => { 
			if (runner) {
				switch(runner.team) {
				case "Team 1":
					twitchPlayer.value.team1.push({ name: runner.name, checked: false, id: "" });
				break;
				case "Team 2":
					twitchPlayer.value.team2.push({ name: runner.name, checked: false, id: "" });
				break;
				case "Team 3":
					twitchPlayer.value.team3.push({ name: runner.name, checked: false, id: "" });
				break;
				case "Team 4":
					twitchPlayer.value.team4.push({ name: runner.name, checked: false, id: "" });
				break;
				}
			}
		});

		_setPlayerDefaults(nextGame.value);
	}
});

//Bingo/ZSRM Exclusive
/*
nextGame.on('change', newVal => {

	if (!newVal)
		return;

	if (!newVal.runners)
		return;

	var a = true;

	if (twitchPlayer.value.runnerList.length > 0)
		twitchPlayer.value.runnerList.length = 0;

	newVal.runners.forEach(runner => {

		if (a)
			twitchPlayer.value.streamAURL = runner.stream;
		else
			twitchPlayer.value.streamBURL = runner.stream;

		a = false;


		twitchPlayer.value.runnerList.push({ name: runner.name, checked: false, id: "" });
	});

	_setPlayerDefaults(newVal);
});
*/

function _setPlayerDefaults(currentRunInfo)
{
	var layoutCount = currentRunInfo.notes.split("_");
	layoutCount[1] = "_" + layoutCount[1];
	if ((['3DS', 'Nintendo 3DS', 'NDS', 'Nintendo DS', 'NDSi', 'Nintendo DSi'].includes(nextGame.value.console)) && (currentRunInfo.runners.length <=2)) {
		twitchPlayer.value.streamAWidth = twitchPlayer.value.streamCWidth = twitchPlayer.value.layoutSetup[layoutCount[0]][layoutCount[1]].width;
		twitchPlayer.value.streamAHeight = twitchPlayer.value.streamCHeight = twitchPlayer.value.layoutSetup[layoutCount[0]][layoutCount[1]].height;
		twitchPlayer.value.streamBWidth = twitchPlayer.value.streamDWidth = twitchPlayer.value.layoutSetup[layoutCount[0]][layoutCount[1]].width_bottom;
		twitchPlayer.value.streamBHeight = twitchPlayer.value.streamDHeight = twitchPlayer.value.layoutSetup[layoutCount[0]][layoutCount[1]].height_bottom;
		twitchPlayer.value.streamALeft = twitchPlayer.value.streamCLeft = twitchPlayer.value.layoutSetup[layoutCount[0]][layoutCount[1]].left;
		twitchPlayer.value.streamATop = twitchPlayer.value.streamCTop = twitchPlayer.value.layoutSetup[layoutCount[0]][layoutCount[1]].up;
		twitchPlayer.value.streamBLeft = twitchPlayer.value.streamDLeft = twitchPlayer.value.layoutSetup[layoutCount[0]][layoutCount[1]].left_bottom;
		twitchPlayer.value.streamBTop = twitchPlayer.value.streamDTop = twitchPlayer.value.layoutSetup[layoutCount[0]][layoutCount[1]].up_bottom;
	} else {
		twitchPlayer.value.streamAWidth = twitchPlayer.value.streamBWidth = twitchPlayer.value.streamCWidth = twitchPlayer.value.streamDWidth = twitchPlayer.value.layoutSetup[layoutCount[0]][layoutCount[1]].width;
		twitchPlayer.value.streamAHeight = twitchPlayer.value.streamBHeight = twitchPlayer.value.streamCHeight = twitchPlayer.value.streamDHeight = twitchPlayer.value.layoutSetup[layoutCount[0]][layoutCount[1]].height;
		twitchPlayer.value.streamALeft = twitchPlayer.value.streamBLeft = twitchPlayer.value.streamCLeft = twitchPlayer.value.streamDLeft = twitchPlayer.value.layoutSetup[layoutCount[0]][layoutCount[1]].left;
		twitchPlayer.value.streamATop = twitchPlayer.value.streamBTop = twitchPlayer.value.streamCTop = twitchPlayer.value.streamDTop = twitchPlayer.value.layoutSetup[layoutCount[0]][layoutCount[1]].up;
	}
}

function _askChangeRun() {

    /*
    if (currentRunInfo)
    {
        if (currentRunInfo.shortName == nextGame.value.shortName) {
            nodecg.sendMessage('playerChanged');
            return;
        }
    }
    */

    currentRunInfo = nextGame.value;

    twitchPlayer.value.playerInstanceCreated = false;
    twitchPlayer.value.streamAMuted = false;
    twitchPlayer.value.streamBMuted = true;
    twitchPlayer.value.streamCMuted = true;
    twitchPlayer.value.streamDMuted = true;
    twitchPlayer.value.streamARunning = false;
    twitchPlayer.value.streamBRunning = false;
    twitchPlayer.value.streamCRunning = false;
    twitchPlayer.value.streamDRunning = false;
    twitchPlayer.value.streamAPaused = false;
    twitchPlayer.value.streamBPaused = false;
    twitchPlayer.value.streamCPaused = false;
    twitchPlayer.value.streamDPaused = false;
    twitchPlayer.value.streamAVolume = 1.0;
    twitchPlayer.value.streamBVolume = 1.0;
    twitchPlayer.value.streamCVolume = 1.0;
    twitchPlayer.value.streamDVolume = 1.0;
}

nodecg.listenFor("nextRunner", runner => {
	var id = 0;
	var newRunner = {};
	if (runner.team == "Team 1")
		id = 1;
	else if (runner.team == "Team 2")
		id = 2;
	else if (runner.team == "Team 3")
		id = 3;
	else
		id = 4;
	runners.value.find(repRunner => {
		if ((repRunner.team == runner.team) && (repRunner.slot == (runner.slot+1))) {
			newRunner = {name: repRunner.name, stream: repRunner.stream, slot: repRunner.slot, game: repRunner.game}

			return true;
		}
		return false;
	});
	let delay;
	switch(id) {
		case 1:
			delay = twitchPlayer.value.streamADelay; 
		break;
		case 2:
			delay = twitchPlayer.value.streamBDelay;
		break;
		case 3:
			delay = twitchPlayer.value.streamCDelay;
		break;
		case 4:
			delay = twitchPlayer.value.streamDDelay;
		break;
	}
	let delayCheck = setTimeout(() => {
		switch(id) {
			case 1:
				twitchPlayer.value.streamAURL = newRunner.stream;
				nextGame.value.runners[0] = newRunner;
			break;
			case 2:
				twitchPlayer.value.streamBURL = newRunner.stream;
				nextGame.value.runners[1] = newRunner;
			break;
			case 3:
				twitchPlayer.value.streamCURL = newRunner.stream;
				nextGame.value.runners[2] = newRunner;
			break;
			case 4:
				twitchPlayer.value.streamDURL = newRunner.stream;
				nextGame.value.runners[3] = newRunner;
			break;
		}
	}, delay+8000); // switch runner 8 seconds after restream caught up.
	nodecg.sendMessage("dashboardupdate");
});
function _askSwitchRunners(teamNr)
{
    log.info("new runner list for team " + teamNr);

    var count = 0;
    var id = 0;
	var newRunnerList = nextGame.value.runners;
	var team;

	switch(teamNr) {
		case 1:
			team = twitchPlayer.value.team1;
		break;
		case 2:
			team = twitchPlayer.value.team2;
		break;
		case 3:
			team = twitchPlayer.value.team3;
		break;
		case 4:
			team = twitchPlayer.value.team4;
		break;
	}
    team.forEach(newRunner => {
     
        if (newRunner.checked)
			count++;
	});

	team.forEach(newRunner => {  
        if (newRunner.checked)
        {
            if (newRunner.id == "---> Team A")
               id = 1;
            else if (newRunner.id == "---> Team B")
               id = 2;
            else if (newRunner.id == "---> Team C")
               id = 3;
            else
			   id = 4;
			nodecg.log.info("count: " + count);
            runners.value.find(runner => {
                if (runner) {
                    if (runner.name === newRunner.name) {
						log.info("play runner[" + id + "]: " + newRunner.name + " with stream: " + runner.stream);
	                		switch (id) {
								case 1:
									if (twitchPlayer.value.streamAURL !== runner.stream)
										twitchPlayer.value.streamAURL = runner.stream;

									newRunnerList[0] = { name: newRunner.name, stream: runner.stream, slot: runner.slot, game: runner.game };

									break;
								case 2:
									if (twitchPlayer.value.streamBURL !== runner.stream)
										twitchPlayer.value.streamBURL = runner.stream;

									newRunnerList[1] = { name: newRunner.name, stream: runner.stream, slot: runner.slot, game: runner.game };

									break;
								case 3:
									if (twitchPlayer.value.streamCURL !== runner.stream)
										twitchPlayer.value.streamCURL = runner.stream;
				
									newRunnerList[2] = { name: newRunner.name, stream: runner.stream, slot: runner.slot, game: runner.game };

									break;
								case 4:
									if (twitchPlayer.value.streamDURL !== runner.stream)
										twitchPlayer.value.streamDURL = runner.stream;

									newRunnerList[3] = { name: newRunner.name, stream: runner.stream, slot: runner.slot, game: runner.game };

									break;
								default:
									break;
							}
						
                        return true;
                    }
                }

                return false;
            });
        }
	});

	nextGame.value.runners = newRunnerList;
	
	if (count > 0) {

		let layout;

		if (nextGame.value.console === "GBA")
			layout = "GBA_";
		else if (['Gameboy', 'GBC', 'Gameboy Color'].includes(nextGame.value.console))
			layout = "Gameboy_";
		else if (['NDS', 'Nintendo DS', 'NDSi', 'Nintendo DSi'].includes(nextGame.value.console))
			layout = "DS_";
		else if (['3DS', 'Nintendo 3DS'].includes(nextGame.value.console))
			layout = "3DS_";
		else if (['Wii', 'Wii U', 'Switch'].includes(nextGame.value.console))
			layout = "Widescreen_";
		else
			layout = "Standard_";

		layout = layout.concat(count.toString());

		nextGame.value.notes = layout;

		_setPlayerDefaults(nextGame.value);

		obs.setCurrentScene(layout).catch(ex => log.info(ex.error));
	}
	else
	{
		log.info("No runners selected!");
	}


}

function _takeStreamSnapshot(id)
{
	var streamUrl;

	if (id == 0)
		streamUrl = twitchPlayer.value.streamAURL;
	else if (id == 1)
		streamUrl = twitchPlayer.value.streamBURL;
	else if (id == 2)
		streamUrl = twitchPlayer.value.streamCURL;
	else if (id == 3)
		streamUrl = twitchPlayer.value.streamDURL;

	//console.log("dump stream: " + streamUrl);

	//console.log("save snaps at: ", snapPath);

	twitchStreams.get(streamUrl)
		.then(function (streams) {

			var options = {
				playlistUrl: streams[0].url,
				outputDir: snapPath,
				tempDir: snapPath,
				initialThumbnailCount: 1,
				interval: null,
				targetThumbnailCount: 1,
				thumbnailWidth: 1280,
				thumbnailHeight: 720,
				outputNamePrefix: "snap"
			};

			thumbGenerator = new hls.ThumbnailGenerator(options);
			thumbGenerator.getEmitter().on("newThumbnail", thumb => {

				console.log("newThumb: ", thumb.name);

				thumbGenerator.destroy();

				if (fs.existsSync(snapPath + "/" + id + ".jpg"))
					fs.unlinkSync(snapPath + "/" + id + ".jpg");

				fs.renameSync(snapPath + "/" + thumb.name, snapPath + "/" + id + ".jpg");

				console.log("Screenshot of Stream finished");

				nodecg.sendMessage("refreshLayoutDashImages");
			});

		}).catch(function (ex) {

			console.log("Exception in twitchStreams: ", ex);
		});
}

