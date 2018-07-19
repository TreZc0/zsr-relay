(function () {
    'use strict';

    const twitchPlayer = nodecg.Replicant('twitchPlayer');
	const runnerJSON = nodecg.Replicant('runners');
	const currentRun = nodecg.Replicant('currentRun');

    class StreamAssignments3 extends Polymer.MutableData(Polymer.Element) {
        static get is() {
            return 'stream-assignments3';
        }

        ready()
        {
            super.ready();

            const replicants = 
            [
                twitchPlayer,
                runnerJSON
            ];

            let numDeclared = 0;
            replicants.forEach(replicant => {
                replicant.once('change', () => {
                    numDeclared++;

                    // Start the loop once all replicants are declared
                    if (numDeclared >= replicants.length) {
                        twitchPlayer.on('change', newVal => {

                            this.runnerList = newVal.team3;

                            var count = 0;
                            var link = "kadgar.net Link";

                            newVal.team3.find(runner => {
                                if (runner.checked == true && runner.id == "---> Team C") {
                                    if (count == 0) {
                                        link = "http://kadgar.net/live";
                                    }

                                    link = link.concat("/");

                                    runnerJSON.value.find(runnerIndex => {
                                        if (runnerIndex) {
                                            if (runnerIndex.name === runner.name) {
                                                link = link.concat(runnerIndex.stream);
                                            }
                                        }
                                    });

                                    count++;

                                    return true;
                                }

                                return false;
                            });	
                        });
                    }
                });
            });
                
            this._checkboxChanged = this._checkboxChanged.bind(this);
            this.addEventListener('change', this._checkboxChanged);
        }

        _assignStreams()
        {
			nodecg.sendMessage("askSwitchRunners", 3);

			/* if (this.$.kadgarLink.value.length > 24)
				 nodecg.sendMessage("assignmentsChanged", this.$.kadgarLink.value); //send kadgar link to discord bot */
        }

        _checkboxChanged(e)
        {
            const target = e.path[0];

            var name = target.innerText.trim();

            if (name.indexOf("--->") != -1) {

                name = name.substr(0, name.indexOf("--->"));
                name = name.trim();
            }

            var count = 0;

            twitchPlayer.value.team3.forEach(runner => {
                
                if (runner.checked == true)
                    count++;
            });

            twitchPlayer.value.team3.find(runner => {
                if (runner.name === name)
				{
					// let hasDualScreen = ['NDS', 'Nintendo DS', 'NDSi', 'Nintendo DSi', '3DS', 'Nintendo 3DS'].includes(currentRun.value.console);
                    if (target.checked)
                    {
                        runner.checked = true;

                        var runnerFound = false;

                        twitchPlayer.value.team3.find(runnerSearch => {
                            if (runnerSearch.checked == true && runnerSearch.id == "---> Team C")
                            {
                                runnerFound = true;

                                return true;
                            }

                            return false;
                        });

                        if (!runnerFound)
                        {
                            runner.id = "---> Team C";
                        }
                    }
                    else
                    {
                        runner.checked = false;
                        runner.id = "";
                    }

                    return true;
                }

                return false;
            });      
        }
    }

    customElements.define(StreamAssignments3.is, StreamAssignments3);
})();
