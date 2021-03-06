'use strict';

const events = require('events');
var emitter = require('./emitter');
const request = require('request-promise').defaults({jar: true}); // <= Automatically saves and re-uses cookies.
const TimeObject = require('../shared/classes/time-object');

// Ours
const nodecg = require('./util/nodecg-api-context').get();
const path = require('path');
const easyjson = require('easyjson');
const editJsonFile = require("edit-json-file");
const twitchPlayer = nodecg.Replicant('twitchPlayer');
const currentRun = nodecg.Replicant('currentRun');
const runners = nodecg.Replicant('runners');
const log = new nodecg.Logger(`${nodecg.bundleName}:leaderboard`);
const schedule = nodecg.Replicant('schedule');
const stopwatch = nodecg.Replicant('stopwatch');
const leaderboard = nodecg.Replicant('leaderboard', {
	defaultValue: {

		raceID: "",
		runName: "",
		forceStart: false,
		forceStop: false,
		forceTime: 0,
		forceDelay: 0,
		ranking: []

	}, persistent: true
});



var delayInProgress = false;

nodecg.listenFor('importRunnersFromSRL', _importRunners);

currentRun.on('change', newVal =>
{
	if (!newVal)
		return;

	if ((!leaderboard.value.runName) || leaderboard.value.runName == "" || leaderboard.value.runName != newVal.name)
	{
        if (leaderboard.value.ranking)
		    leaderboard.value.ranking.length = 0;

		leaderboard.value.runName = newVal.name;

		log.info("New run started! Reset Rankings...");
	}
});

function loop()
{   
    if (leaderboard.value.raceID === "")
    {
        setTimeout(() => {
            loop();
        }, 10000);

        return;
    }

    const racesPromise = request({
        uri: 'http://api.speedrunslive.com/races',
        json: true
    });

    Promise.all([racesPromise]).then(([racesJSON]) => 
    {
        for (var i = 0; i < racesJSON.count; i++) 
        {
            if (leaderboard.value.raceID == racesJSON.races[i].id)
            {  
                //log.info("Update " + racesJSON.races[i].game.name);
                
                Object.keys(racesJSON.races[i].entrants).forEach(function(key) 
                {
                    if (racesJSON.races[i].entrants[key].statetext == "Finished" || racesJSON.races[i].entrants[key].statetext == "Forfeit")
                    {
                        let foundRunner = false;

                        leaderboard.value.ranking.find(finishedRunner =>
                        {
                            if (finishedRunner.stream == racesJSON.races[i].entrants[key].twitch)
                            {
                                foundRunner = true;

                                let newTimeString = "";

                                let hours = 0;
                                let minutes = 0;
                                let seconds = 0;

                                if (racesJSON.races[i].entrants[key].time > 59) {
                                    minutes = Math.floor(racesJSON.races[i].entrants[key].time / 60);
                                    seconds = racesJSON.races[i].entrants[key].time - (minutes * 60);

                                    if (minutes > 59) 
                                    {
                                        hours = Math.floor(minutes / 60);
                                        minutes -= hours * 60;
                         
                                        newTimeString = newTimeString.concat(hours.toString());
                                        newTimeString = newTimeString.concat(":");
                                        newTimeString = newTimeString.concat(("0" + minutes.toString()).slice(-2));
                                        newTimeString = newTimeString.concat(":");
                                        newTimeString = newTimeString.concat(("0" + seconds.toString()).slice(-2));
                                    }
                                    else
                                    {                 
                                        newTimeString = newTimeString.concat(minutes.toString());
                                        newTimeString = newTimeString.concat(":");
                                        newTimeString = newTimeString.concat(("0" + seconds.toString()).slice(-2));
                                    }
                                }
                                else 
                                {
                                    seconds = racesJSON.races[i].entrants[key].time;
                                }

                                /*
                                newTimeString = newTimeString.concat(("0" + hours.toString()).slice(-2));
                                newTimeString = newTimeString.concat(":");
                                newTimeString = newTimeString.concat(("0" + minutes.toString()).slice(-2));
                                newTimeString = newTimeString.concat(":");
                                newTimeString = newTimeString.concat(("0" + seconds.toString()).slice(-2));
                                */

                                if (racesJSON.races[i].entrants[key].statetext == "Forfeit")
                                    newTimeString = "Quit";

                                finishedRunner = {
                                    name: finishedRunner.name,
                                    stream: finishedRunner.stream,
                                    status: racesJSON.races[i].entrants[key].statetext, 
                                    place: racesJSON.races[i].entrants[key].place,
                                    time: racesJSON.races[i].entrants[key].time,
                                    timeFormat: newTimeString};

                                return true;
                            }

                            return false;
                        });

                        if (foundRunner == false)
                        {
                            let newTimeString = "";

                            let hours = 0;
                            let minutes = 0;
                            let seconds = 0;
           
                            if (racesJSON.races[i].entrants[key].time > 59) {
                                minutes = Math.floor(racesJSON.races[i].entrants[key].time / 60);
                                seconds = racesJSON.races[i].entrants[key].time - (minutes * 60);

                                if (minutes > 59) 
                                {
                                    hours = Math.floor(minutes / 60);
                                    minutes -= hours * 60;
                         
                                    newTimeString = newTimeString.concat(hours.toString());
                                    newTimeString = newTimeString.concat(":");
                                    newTimeString = newTimeString.concat(("0" + minutes.toString()).slice(-2));
                                    newTimeString = newTimeString.concat(":");
                                    newTimeString = newTimeString.concat(("0" + seconds.toString()).slice(-2));
                                }
                                else
                                {                 
                                    newTimeString = newTimeString.concat(minutes.toString());
                                    newTimeString = newTimeString.concat(":");
                                    newTimeString = newTimeString.concat(("0" + seconds.toString()).slice(-2));
                                }
                            }
                            else 
                            {
                                seconds = racesJSON.races[i].entrants[key].time;
                            }

                            if (racesJSON.races[i].entrants[key].statetext == "Forfeit")
                                newTimeString = "Quit";

                            let runnerName = "";

                            runners.value.find(runnerIndex => 
                            {
                                if (runnerIndex) 
                                {
                                    if (runnerIndex.stream === racesJSON.races[i].entrants[key].twitch) 
                                    {
                                        runnerName = runnerIndex.name;

                                        return true;
                                    }
                                }

                                return false;
                            });   

                            log.info("New Runner " + runnerName + " Status: " + racesJSON.races[i].entrants[key].statetext + " Place: " + racesJSON.races[i].entrants[key].place + " Time: " + newTimeString);

                            leaderboard.value.ranking.push({
                                name: runnerName,
                                stream: racesJSON.races[i].entrants[key].twitch, 
                                status: racesJSON.races[i].entrants[key].statetext, 
                                place: racesJSON.races[i].entrants[key].place,
                                time: racesJSON.races[i].entrants[key].time,
                                timeFormat: newTimeString
                            })                      
                        }
                    }
                    else
                    {
                        let index = 0;
                        leaderboard.value.ranking.find(finishedRunner =>
                        {
                            if (finishedRunner.stream == racesJSON.races[i].entrants[key].twitch)
                            {                             
                                log.info("Runner " + racesJSON.races[i].entrants[key].displayname + " unfinished or unforfeited. Purge from ranking!");

                                leaderboard.value.ranking.splice(index, 1);
                                return true;                             
                            }

                            index++;

                            return false;
                        });
                    }
                });

                if (delayInProgress == false && (racesJSON.races[i].state == 4 || racesJSON.races[i].state == 5) && (stopwatch.value.state === 'running' || stopwatch.value.raw == 0))
                {
                    log.info("This race is finished and timer still runs or is at 0, stop timer and set final time!");

                    delayInProgress = true;

                    setTimeout(() => {
                        leaderboard.value.forceStop = true;
                        leaderboard.value.forceStart = false;

                        var indexLastFinished = 0;

                        leaderboard.value.ranking.forEach(rank =>
                        {
                            if (rank.status == "Finished")
                                indexLastFinished++;
                        });

                        leaderboard.value.ranking.find(finishedRunner =>
                        {
                            if (finishedRunner.place == indexLastFinished)
                            {
                                leaderboard.value.forceTime = finishedRunner.time;

                                return true;
                            }

                            return false;
                        });

                        delayInProgress = false;

                    }, twitchPlayer.value.streamLeaderDelay);      
                }

                //log.info("update, state: " + racesJSON.races[i].state.toString() + " stopwatch: " + stopwatch.value.state);

                if (delayInProgress == false && racesJSON.races[i].state == 3 && stopwatch.value.state != 'running')
                {
                    delayInProgress = true;

                    log.info("This race is running and the timer isnt running, start timer and edit time!");

                    let d = new Date();
                    let secondsSinceEpoch = Math.floor(d.getTime() / 1000);
       
                    setTimeout(() => {
                     
                        leaderboard.value.forceStop = false;
                        leaderboard.value.forceStart = true;        

                        leaderboard.value.forceTime = secondsSinceEpoch - racesJSON.races[i].time;

                        delayInProgress = false;

                    }, twitchPlayer.value.streamLeaderDelay);                       
                }

                break;           
            }
        }

        setTimeout(() => {
            loop();
        }, 1000);

    }).catch(error => {
        const response = error.response;
        const actualError = error.error || error;
        if (response && response.statusCode === 403) {
            nodecg.log.warn('[SRL] Permission denied, refreshing session and trying again...');
        } else if (response) {
            nodecg.log.error('[SRL] Failed to update, got status code', response.statusCode);
        } else {
            nodecg.log.error('[SRL] Failed to update:', actualError);
        }

        setTimeout(() => {
            loop();
        }, 2000);
    });
}

function _importRunners(id) 
{
    const racesPromise = request({
        uri: 'http://api.speedrunslive.com/races',
        json: true
    });

    Promise.all([racesPromise]).then(([racesJSON]) => 
    {
        for (var i = 0; i < racesJSON.count; i++) 
        {
            if (id == racesJSON.races[i].id)
            {   
                runners.value.length = 0;
             
                Object.keys(racesJSON.races[i].entrants).forEach(function(key) 
                {
                    log.info("Import Runner - Name: " + racesJSON.races[i].entrants[key].displayname + " ; Twitch: " + racesJSON.races[i].entrants[key].twitch);

                    runners.value.push({name: racesJSON.races[i].entrants[key].displayname, stream: racesJSON.races[i].entrants[key].twitch});
                });

                break;
            }
        }
    }).catch(error => {
        const response = error.response;
        const actualError = error.error || error;
        if (response && response.statusCode === 403) {
            nodecg.log.warn('[SRL] Permission denied, refreshing session and trying again...');
        } else if (response) {
            nodecg.log.error('[SRL] Failed to update, got status code', response.statusCode);
        } else {
            nodecg.log.error('[SRL] Failed to update:', actualError);
        }
    });
}
emitter.eventBus.on('raceFinished', _tournamentTable);

function _tournamentTable()
{
	let standingsPath = path.resolve(process.env.NODECG_ROOT, 'bundles/external-assets/graphics/img/standings/standings.json');
    let json = editJsonFile(standingsPath);
    let tournament = json.get("tournament");
    let resultPage = tournament[0].results;
    let standingsPage = tournament[0].standings;
    var foundRunner;
    var racetimes = [];
    resultPage[0].rankings.forEach(participant => {
        log.info(participant.name + " finished in " + participant.timeFormat);
        if (!standingsPage.length == 0) {
            foundRunner = standingsPage.find(racer => {
                if (racer.name == participant.name)
                    return true;
                return false;
            });
        }
        if ((standingsPage.length == 0) || (!foundRunner)) {
            racetimes = [];
            racetimes.push({race: resultPage[0].race, time: participant.time, timeFormat: participant.timeFormat});
            standingsPage.push({
                name: participant.name,
                stream: participant.stream,
                amount: 1,
                times: racetimes,
                delta: participant.time,
                deltaFormat: participant.timeFormat 
            });
        } else {
            log.info("runner already participated - adjust data and calculate delta!");
            var index = standingsPage.findIndex(obj => obj.name === participant.name);
            if (participant.status === "Forfeit")
                return;
            var amount = standingsPage[index].amount + 1;
            racetimes = standingsPage[index].times;
            racetimes.push({race: resultPage[0].race, time: participant.time, timeFormat: participant.timeFormat}); 
            racetimes.sort(function (a, b) {
                if (a.time > b.time) {
                  return 1;
                }
                if (a.time < b.time) {
                  return -1;
                }
                // a muss gleich b sein
                return 0;
            }); //3 best times up front
            if (racetimes.length > 3) {
                racetimes.length = 3;
                amount = 3;
            } // if more than 3 times, remove all others and set amount to 3.
            var sumTime = standingsPage[index].times[0].time;
            for (var i = 1; i < racetimes.length; i++) {
                sumTime = sumTime + standingsPage[index].times[i].time;
            } // sum all times (up to 3)
            var deltaTime = Math.round(sumTime / amount);
            var deltaFormat = _timeFormat(deltaTime);
            
            standingsPage[index] =
            {
                name: participant.name,
                stream: participant.stream,
                amount: amount,
                times: racetimes,
                delta: deltaTime,
                deltaFormat: deltaFormat
            };          
        }
    });
    standingsPage.sort(function (a, b) {
        if (a.delta > b.delta) {
          return 1;
        }
        if (a.delta < b.delta) {
          return -1;
        }
        // a muss gleich b sein
        return 0;
      });
    
    for (var index = 0; index < standingsPage.length; index++) {
        standingsPage[index].place = index+1;
    }
    json.set("tournament", tournament);
    json.save();
    log.info("new standings calculated!");  
}

function _timeFormat(delta)
{ 
    var hours = Math.floor(delta / 3600) < 10 ? ("00" + Math.floor(delta / 3600)).slice(-2) : Math.floor(delta / 3600);
    var minutes = ("00" + Math.floor((delta % 3600) / 60)).slice(-2);
    var seconds = ("00" + (delta % 3600) % 60).slice(-2);
    return hours + ":" + minutes + ":" + seconds;
}

loop();
