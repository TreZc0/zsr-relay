(function () {
	'use strict';

	const NAME_FADE_DURATION = 0.33;
	const NAME_FADE_IN_EASE = Power1.easeOut;
	const NAME_FADE_OUT_EASE = Power1.easeIn;
	const currentRun = nodecg.Replicant('currentRun');
	const stopwatch = nodecg.Replicant('stopwatch');
	const leaderboard = nodecg.Replicant('leaderboard');
	const twitchPlayer = nodecg.Replicant('twitchPlayer');
	const gameAudioChannels = nodecg.Replicant('gameAudioChannels');

	const teams = nodecg.Replicant('teams');
	const runners = nodecg.Replicant('runners');

	class RelayTeamPlate extends Polymer.MutableData(Polymer.Element) {
		static get is() {
			return 'relay-teamplate';
		}

		static get properties() {
			return {
				index: Number,
				audio: {
					reflectToAttribute: true,
					observer: 'audioChanged'
				},
				attachLeft: {
					type: Boolean,
					reflectToAttribute: true,
					observer: 'attachLeftChanged'
				},
				attachRight: {
					type: Boolean,
					reflectToAttribute: true,
					observer: 'attachRightChanged'
				},
				attachBottom: {
					type: Boolean,
					reflectToAttribute: true,
					observer: 'attachBottomChanged'
				},
				coop: {
					type: Boolean,
					reflectToAttribute: true
				},
				forfeit: {
					type: Boolean,
					reflectToAttribute: true,
					value: false
				},
				done: {
				    type: Boolean,
				    value: false
				},
				time: String,
				place: Number,
				name: {
					type: String,
					value: ''
				},
				twitch: {
					type: String,
					value: ''
				},
				timeTL: {
					type: TimelineLite,
					value() {
						return new TimelineLite({autoRemoveChildren: true});
					},
					readOnly: true
				},
				audioTL: {
					type: TimelineLite,
					value() {
						return new TimelineLite({autoRemoveChildren: true});
					},
					readOnly: true
				},
				columnsperline: {
					type: Number,
					value: 1
				},
				tablewidth: {
					type: Number,
					value: 300
				},
				rowWidth: {
					type: Number,
					reflectToAttribute: true,
					value: 200
				},
				textMaxLength: {
					type: Number,
					reflectToAttribute: true,
					value: 130
				},
				teamMembers: {
					type: Array,
					reflectToAttribute: true,
					value: []
				}
			};
		}

		audioChanged(newVal) {
			// I have no idea why, but sometimes an empty string makes its way into this function??
			if (typeof newVal !== 'boolean') {
				return;
			}

			if (newVal) {
				if (this.attachRight) {
					this.audioTL.to({}, 0.633, {
						onStart() {
							if (this._leftCapOpen) {
								return;
							}

							this._leftCapOpen = true;
							this._leftCapSprite.gotoAndPlay('open');
						},
						onStartScope: this
					});
				}

				if (this.attachLeft) {
					this.audioTL.to({}, 0.633, {
						onStart() {
							if (this._rightCapOpen) {
								return;
							}

							this._rightCapOpen = true;
							this._rightCapSprite.gotoAndPlay('open');
						},
						onStartScope: this
					});
				}
				if (this.attachBottom) {
					this.audioTL.to({}, 0.633, {
						onStart() {
							if (this._rightCapOpen) {
								return;
							}
							this._leftCapOpen = true;
							this._leftCapSprite.gotoAndPlay('open');
							this._rightCapOpen = true;
							this._rightCapSprite.gotoAndPlay('open');
						},
						onStartScope: this
					});
				}
			} else {
				if (this.attachRight) {
					this.audioTL.to({}, 0.35, {
						onStart() {
							if (!this._leftCapOpen) {
								return;
							}

							this._leftCapOpen = false;
							this._leftCapSprite.gotoAndPlay('close');
						},
						onStartScope: this
					});
				}

				if (this.attachLeft) {
					this.audioTL.to({}, 0.35, {
						onStart() {
							if (!this._rightCapOpen) {
								return;
							}

							this._rightCapOpen = false;
							this._rightCapSprite.gotoAndPlay('close');
						},
						onStartScope: this
					});
				}
				
				if (this.attachBottom) {
					this.audioTL.to({}, 0.35, {
						onStart() {
							if (!this._rightCapOpen) {
								return;
							}
							
							this._leftCapOpen = false;
							this._leftCapSprite.gotoAndPlay('close');
							this._rightCapOpen = false;
							this._rightCapSprite.gotoAndPlay('close');
						},
						onStartScope: this
					});
				}
			}
		}

		attachLeftChanged(newVal) {
			if (newVal && this.attachRight) {
				this.attachRight = false;
				this.attachBottom = false;
			}
		}

		attachRightChanged(newVal) {
			if (newVal && this.attachLeft) {
				this.attachLeft = false;
				this.attachBottom = false;
			}
		}
		
		attachBottomChanged(newVal) {
			if (newVal && this.attachBottom) {
				this.attachLeft = false;
				this.attachRight = false;
			}
		}

		showTime() {
			if (this._timeShowing) {
				return;
			}

			this._timeShowing = true;

			this.timeTL.clear();
			this.timeTL.call(() => {
				this.$.timeShine.style.width = '140%';
				if (this.attachRight) {
					this.$.timeClip.style.webkitClipPath = 'polygon(0 0, 140% 0%, calc(140% - 15px) 100%, 0% 100%)';
				} else if (this.attachLeft) {
					this.$.timeClip.style.webkitClipPath = 'polygon(-40% 0, 100% 0, 100% 100%, calc(-40% + 15px) 100%)';
				} else if (this.attachBottom) {
					this.$.timeClip.style.webkitClipPath = 'polygon(-40% 0, 140% 0, calc(140% - 15px) 100%, calc(-40% + 15px) 100%)';	
				}
			});

			this.timeTL.set(this.$.timeShine, {transition: 'none', width: 0}, '+=1');
			this.timeTL.set(this.$.medal, {zIndex: 1});
			this.timeTL.set(this.$.timeShine, {transition: 'width 400ms linear', width: '140%', opacity: 0.5});
			this.timeTL.set(this.$.medal, {className: '+=shine'}, '+=0.25');
			this.timeTL.set(this.$.medal, {className: '-=shine'}, '+=0.35');
		}

		hideTime() {
			if (!this._timeShowing) {
				return;
			}

			this._timeShowing = false;

			this.timeTL.clear();
			this.timeTL.set(this.$.medal, {clearProps: 'zIndex'});
			this.timeTL.set(this.$.timeShine, {width: 0, clearProps: 'opacity', transition: 'width 325ms ease-in'});
			this.timeTL.set(this.$.timeClip, {
				clearProps: 'webkitClipPath',
				transition: '-webkit-clip-path 325ms ease-in'
			});
		}

		calcMedalImage(newVal, forfeit) {
			if (forfeit) {
				this.showTime();
				return 'elements/zsr-nameplate/img/medal-fail.png';
			}

			switch (newVal) {
				case 1:
					this.showTime();
					return 'elements/zsr-nameplate/img/medal-gold.png';
				case 2:
					this.showTime();
					return 'elements/zsr-nameplate/img/medal-silver.png';
				case 3:
					this.showTime();
					return 'elements/zsr-nameplate/img/medal-bronze.png';
				default:
				    this.showTime();
				    return '';
			}
		}

		ready() {
			super.ready();

			// Create looping anim for main nameplate.
			this.nameTL = new TimelineMax({repeat: -1, paused: true});
			this.nameTL.to(this.$.names, NAME_FADE_DURATION, {
				onStart: function () {
					this.$.namesTwitch.classList.remove('hidden');
					this.$.namesName.classList.add('hidden');
				}.bind(this),
				opacity: 1,
				ease: NAME_FADE_IN_EASE
			});
			this.nameTL.to(this.$.names, NAME_FADE_DURATION, {
				opacity: 0,
				ease: NAME_FADE_OUT_EASE
			}, '+=10');
			this.nameTL.to(this.$.names, NAME_FADE_DURATION, {
				onStart: function () {
					this.$.namesTwitch.classList.add('hidden');
					this.$.namesName.classList.remove('hidden');
				}.bind(this),
				opacity: 1,
				ease: NAME_FADE_IN_EASE
			});
			this.nameTL.to(this.$.names, NAME_FADE_DURATION, {
				opacity: 0,
				ease: NAME_FADE_OUT_EASE
			}, '+=80');

			// Prep canvases
			const leftCapStage = new createjs.Stage(this.$.leftCap);
			const rightCapStage = new createjs.Stage(this.$.rightCap);
			createjs.Ticker.setFPS(60);
			createjs.Ticker.on('tick', () => {
				if (!this.attachLeft)  {
					leftCapStage.update();
				}

				if (!this.attachRight) {
					rightCapStage.update();
				}
				
				if (!this.attachBottom) {
					leftCapStage.update();
					rightCapStage.update();
				}
			});

			const _anims = {
				// start, end, next*, speed*
				open: [0, 37, 'opened'],
				close: {
					frames: [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
					next: 'closed'
				},
				opened: 37,
				closed: 0
			};

			const leftCapSprite = new createjs.Sprite(new createjs.SpriteSheet({
				images: ['elements/zsr-nameplate/img/leftCap.png'],
				frames: [
					[1, 1, 15, 39, 0, -31, 0],
					[18, 1, 17, 39, 0, -29, 0],
					[37, 1, 19, 39, 0, -27, 0],
					[58, 1, 21, 39, 0, -25, 0],
					[81, 1, 23, 39, 0, -23, 0],
					[106, 1, 24, 39, 0, -22, 0],
					[132, 1, 26, 39, 0, -20, 0],
					[160, 1, 28, 39, 0, -18, 0],
					[190, 1, 30, 39, 0, -16, 0],
					[222, 1, 32, 39, 0, -14, 0],
					[256, 1, 33, 39, 0, -13, 0],
					[291, 1, 35, 39, 0, -11, 0],
					[328, 1, 36, 39, 0, -10, 0],
					[366, 1, 38, 39, 0, -8, 0],
					[406, 1, 39, 39, 0, -7, 0],
					[447, 1, 40, 39, 0, -6, 0],
					[1, 42, 41, 39, 0, -5, 0],
					[44, 42, 42, 39, 0, -4, 0],
					[88, 42, 43, 39, 0, -3, 0],
					[133, 42, 43, 39, 0, -3, 0],
					[178, 42, 43, 39, 0, -3, 0],
					[178, 42, 43, 39, 0, -3, 0],
					[178, 42, 43, 39, 0, -3, 0],
					[223, 42, 43, 39, 0, -3, 0],
					[268, 42, 43, 39, 0, -3, 0],
					[313, 42, 43, 39, 0, -3, 0],
					[358, 42, 43, 39, 0, -3, 0],
					[403, 42, 43, 39, 0, -3, 0],
					[1, 83, 43, 39, 0, -3, 0],
					[46, 83, 43, 39, 0, -3, 0],
					[91, 83, 43, 39, 0, -3, 0],
					[136, 83, 43, 39, 0, -3, 0],
					[181, 83, 43, 39, 0, -3, 0],
					[226, 83, 43, 39, 0, -3, 0],
					[271, 83, 43, 39, 0, -3, 0],
					[316, 83, 43, 39, 0, -3, 0],
					[361, 83, 43, 39, 0, -3, 0],
					[406, 83, 43, 39, 0, -3, 0]
				],
				animations: _anims
			}));

			const rightCapSprite = new createjs.Sprite(new createjs.SpriteSheet({
				images: ['elements/zsr-nameplate/img/rightCap.png'],
				frames: [
					[1, 1, 19, 39, 0, 0, 0],
					[22, 1, 21, 39, 0, 0, 0],
					[45, 1, 23, 39, 0, 0, 0],
					[70, 1, 25, 39, 0, 0, 0],
					[97, 1, 27, 39, 0, 0, 0],
					[126, 1, 28, 39, 0, 0, 0],
					[156, 1, 30, 39, 0, 0, 0],
					[188, 1, 32, 39, 0, 0, 0],
					[222, 1, 34, 39, 0, 0, 0],
					[258, 1, 36, 39, 0, 0, 0],
					[296, 1, 37, 39, 0, 0, 0],
					[335, 1, 39, 39, 0, 0, 0],
					[376, 1, 40, 39, 0, 0, 0],
					[418, 1, 42, 39, 0, 0, 0],
					[462, 1, 43, 39, 0, 0, 0],
					[1, 42, 44, 39, 0, 0, 0],
					[47, 42, 45, 39, 0, 0, 0],
					[94, 42, 46, 39, 0, 0, 0],
					[142, 42, 46, 39, 0, 0, 0],
					[190, 42, 46, 39, 0, 0, 0],
					[238, 42, 46, 39, 0, 0, 0],
					[238, 42, 46, 39, 0, 0, 0],
					[238, 42, 46, 39, 0, 0, 0],
					[238, 42, 46, 39, 0, 0, 0],
					[286, 42, 46, 39, 0, 0, 0],
					[334, 42, 46, 39, 0, 0, 0],
					[382, 42, 46, 39, 0, 0, 0],
					[430, 42, 46, 39, 0, 0, 0],
					[1, 83, 46, 39, 0, 0, 0],
					[49, 83, 46, 39, 0, 0, 0],
					[97, 83, 46, 39, 0, 0, 0],
					[145, 83, 46, 39, 0, 0, 0],
					[193, 83, 46, 39, 0, 0, 0],
					[241, 83, 46, 39, 0, 0, 0],
					[289, 83, 46, 39, 0, 0, 0],
					[337, 83, 46, 39, 0, 0, 0],
					[385, 83, 46, 39, 0, 0, 0],
					[433, 83, 46, 39, 0, 0, 0]
				],
				animations: _anims
			}));

			leftCapSprite.gotoAndStop(0);
			rightCapSprite.gotoAndStop(0);

			leftCapStage.addChild(leftCapSprite);
			rightCapStage.addChild(rightCapSprite);

			this._leftCapSprite = leftCapSprite;
			this._rightCapSprite = rightCapSprite;

			// Attach replicant change listeners.
			stopwatch.on('change', this.stopwatchChanged.bind(this));
			gameAudioChannels.on('change', this.gameAudioChannelsChanged.bind(this));

			const replicants = 
            [
               currentRun,
               leaderboard,
               stopwatch,
               gameAudioChannels,
			   twitchPlayer,
			   teams,
			   runners
            ];

			let numDeclared = 0;
			replicants.forEach(replicant => {
			    replicant.once('change', () => {
			        numDeclared++;

			        // Start the loop once all replicants are declared
			        if (numDeclared >= replicants.length)
			        {
			            currentRun.on('change', this.currentRunChanged.bind(this));
						leaderboard.on('change', this.rankingsChanged.bind(this));
						runners.on('change', this.runnersChanged.bind(this));
						teams.on('change', this.teamsChanged.bind(this));
			        }
			    });
			});
		}

		getTeamTotalTime() {

			let foundLastTeamRunner = runners.value.find(runnerAll => {
				if (runnerAll) {

					let foundMatchingTeamRunner = teams.value.teams[this.index].runners.find(teamRunner => {
						if (teamRunner)
							if (teamRunner.name == runnerAll.name)
								return true;

						return false;
					});

					if (foundMatchingTeamRunner) {

						if (runnerAll.slot == 3)
							return true;
					}
				}

				return false;
			});

			if (foundLastTeamRunner) {

				if (foundLastTeamRunner.state == 2)
					return foundLastTeamRunner.fullTimeFormat;
			}

			return '-';
		}

		getTimeForTeamMember(runnerName) {

			let foundTeamRunner = runners.value.find(runnerAll => {
				if (runnerAll) {

					if (runnerAll.name == runnerName)
						return true;
				}

				return false;
			});

			if (foundTeamRunner) {

				if (foundTeamRunner.state == 2)
					return foundTeamRunner.timeFormat;
			}

			return '-';
		}

		generateTeamTable() {

			this.teamMembers.length = 0;

			const team = teams.value.teams[this.index];		
	
			let lineCount = team.runners.length;

			console.log("Need " + lineCount + " lines to render this team array!");

			let columnCount = this.columnsperline;

			//Calculate available screen estate for each row and name field
			this.rowWidth = this.tablewidth - 20; //both table borders combined (left/right table margin a 10 pixels)
			this.textMaxLength = this.rowWidth;
			this.rowWidth = Math.floor(this.rowWidth / columnCount); //rows take 1/x of the space left e.g. 50% each for 2 columns per line, now hardcoded

			this.textMaxLength -= ((columnCount - 1) * 10); //10 px padding for every extra column after the first one to create a gap
			//this.textMaxLength -= columnCount * 42; //for every avatar and its padding
			this.textMaxLength = Math.floor(this.textMaxLength / columnCount);

			console.log("This table with " + columnCount + " columns per line and a base field size of " + this.tablewidth + " pixels has " + this.textMaxLength + " pixels of space per name field and " + this.rowWidth + " pixels for every row!");

			let arrayIndex = 0;
			let newArray = [];

			for (var i = 0; i < 1; i++) {
				let line = [];

				for (var n = 0; n < this.columnsperline; n++) {

					let column = { id: arrayIndex, memberString: "" };
					let finalString = team.runners[arrayIndex].name;

					finalString = finalString.concat(" (" + team.runners[arrayIndex].game + ") ");
					finalString = finalString.concat(this.getTimeForTeamMember(team.runners[arrayIndex].name));

					column.memberString = finalString;

					console.log("add string " + column.memberString + " to line " + i);

					line.push(column);

					arrayIndex++;
				}

				newArray.push(line);
			}

			this.set("teamMembers", newArray);
			//this.notifyPath("teamMembers", this.teamMembers);

			setTimeout(() => { //delay so html elements can render first before updating it

				this.teamMembers.forEach(line => {
					line.forEach(entry => {
						Polymer.dom(this.root).querySelector("#td_" + entry.id).style.minWidth = this.rowWidth.toString() + "px";
					});
				});

				/*
				if (columnCount < this.columnsperline) {
					this.teamMembers.forEach(line => {
						line.forEach(entry => {
							Polymer.dom(this.root).querySelector("#container_" + entry.id).style.display = "table";
							Polymer.dom(this.root).querySelector("#container_" + entry.id).style.margin = "0 auto -50px";
						});
					});
				}
				*/

			}, 500);
		}

		setupTeamData() {

			const team = teams.value.teams[this.index];
			if (team) {
				this.name = team.teamname;
				this.twitch = this.getTeamTotalTime();

				this.generateTeamTable();
			} else {
				this.name = '?';
				this.twitch = '?';
				this.teamMembers.length = 0;
			}
		}

		runnersChanged(newVal, oldVal) {

			if (newVal)
				this.setupTeamData();

		}

		teamsChanged(newVal, oldVal) {

			if (newVal)
				this.setupTeamData();
		}

		/*
		 * 1) For singleplayer, if both match (ignoring capitalization), show only twitch.
		 * 2) For races, if everyone matches (ignoring capitalization), show only twitch, otherwise,
		 *    if even one person needs to show both, everyone shows both.
		 */
		currentRunChanged(newVal, oldVal)
		{
			// If nothing has changed, do nothing.
			if (oldVal && JSON.stringify(newVal.runners) === JSON.stringify(oldVal.runners)) {
				return;
			}

            //DB: Reset vars
			this.done = false;			
			this.forfeit = false;			       
			this.place = 0;
			this.time = "";

			this.coop = newVal.coop;

			let canConflateAllRunners = true;
			newVal.runners.forEach(runner => {
				if (runner) {
					if (!runner.stream || runner.name.toLowerCase() !== runner.stream.toLowerCase()) {
						canConflateAllRunners = false;
					}
				}
			});

			this.setupTeamData();

			TweenLite.to(this.$.names, NAME_FADE_DURATION, {
				opacity: 0,
				ease: NAME_FADE_OUT_EASE,
				onComplete: function () {
					this.$.namesName.classList.add('hidden');
					this.$.namesTwitch.classList.remove('hidden');

					if (!this.twitch) {
						this.nameTL.pause();
						this.$.namesName.classList.remove('hidden');
						this.$.namesTwitch.classList.add('hidden');
						TweenLite.to(this.$.names, NAME_FADE_DURATION, {opacity: 1, ease: NAME_FADE_IN_EASE});
					} else if (canConflateAllRunners) {
						this.nameTL.pause();
						TweenLite.to(this.$.names, NAME_FADE_DURATION, {opacity: 1, ease: NAME_FADE_IN_EASE});
					} else {
						this.nameTL.restart();
					}

					Polymer.RenderStatus.afterNextRender(this, this.fitName);
				}.bind(this)
			});

			this.rankingsChanged(leaderboard.value);
		}

		fitName() {
			Polymer.flush();
			const MAX_NAME_WIDTH = this.$.names.clientWidth - 32;
			const MAX_TWITCH_WIDTH = MAX_NAME_WIDTH - 20;
			const twitchText = this.$.namesTwitch.querySelector('sc-fitted-text');
			this.$.namesName.maxWidth = MAX_NAME_WIDTH;
			twitchText.maxWidth = MAX_TWITCH_WIDTH;
		}

		stopwatchChanged(newVal)
		{
            /*
			if (newVal.results[this.index]) {
				this.forfeit = newVal.results[this.index].forfeit;
				this.place = newVal.results[this.index].place;
				this.time = newVal.results[this.index].formatted;

				if (this.done == false) {
				    this.audio = false;
				    this.done = true;
				}

			} else {
				this.forfeit = false;
				this.place = 0;

				if (this.done == true) {
				    this.done = false;
				    this.audio = !gameAudioChannels.value[this.index].audio.muted;
				}
			}
            */
		}

		rankingsChanged(newVal)
		{
			if (!newVal)
				return;

			if (!currentRun.value.runners)
				return;

			if (currentRun.value.runners.length < (this.index + 1))
				return;

			let runnerFound = false;

			const runner = currentRun.value.runners[this.index];

			console.log("[" + this.index + "] rankings changed, runner: " + runner.name);

		    newVal.ranking.find(finishedRunner => 
		    {
		        if (finishedRunner.name == runner.name)
		        {
		            if (this.done == false)
		            {
		                var delay = 0;

		                if (twitchPlayer.value.streamAURL == runner.stream)
		                    delay = twitchPlayer.value.streamADelay;
		                else if (twitchPlayer.value.streamBURL == runner.stream)
		                    delay = twitchPlayer.value.streamBDelay;
		                else if (twitchPlayer.value.streamCURL == runner.stream)
		                    delay = twitchPlayer.value.streamCDelay;
		                else if (twitchPlayer.value.streamDURL == runner.stream)
		                    delay = twitchPlayer.value.streamDDelay;

		                setTimeout(() =>
		                {
		                    if (finishedRunner.status === "Forfeit")
		                        this.forfeit = true;
		                    else
		                        this.forfeit = false;

		                    this.place = finishedRunner.place;
		                    this.time = finishedRunner.timeFormat;

		                    this.done = true;
		                    this.audio = false;

		                    console.log("Finish runner: " + finishedRunner.name + " forfeited: " + this.forfeit.toString() + " place: " + this.place.toString() + " time: " + finishedRunner.timeFormat);

		                }, delay);	  
		            }

		            runnerFound = true;

		            return true;
		        }

		        return false;
		    });

		    if (runnerFound == false)
            {
		        this.forfeit = false;
		        this.place = 0;

		        if (this.done == true)
		        {
		            var delay = 0;

		            if (twitchPlayer.value.streamAURL == runner.stream)
		                delay = twitchPlayer.value.streamADelay;
		            else if (twitchPlayer.value.streamBURL == runner.stream)
		                delay = twitchPlayer.value.streamBDelay;
		            else if (twitchPlayer.value.streamCURL == runner.stream)
		                delay = twitchPlayer.value.streamCDelay;
		            else if (twitchPlayer.value.streamDURL == runner.stream)
		                delay = twitchPlayer.value.streamDDelay;

		            setTimeout(() =>
		            {
		                this.done = false;
		                this.audio = !gameAudioChannels.value[this.index].audio.muted;

		                if (this._timeShowing) {

		                    console.log("hide time asap");

		                    this._timeShowing = false;

		                    this.timeTL.clear();
		                    this.timeTL.set(this.$.medal, { clearProps: 'zIndex' });
		                    this.timeTL.set(this.$.timeShine, { width: 0, clearProps: 'opacity', transition: 'width 325ms ease-in' });
		                    this.timeTL.set(this.$.timeClip, {
		                        clearProps: 'webkitClipPath',
		                        transition: '-webkit-clip-path 325ms ease-in'
		                    });
		                }

		            }, delay);

		            console.log("unfinish this runner");
	
		        }
		        else
		        {
		            if (this._timeShowing) {

		                console.log("hide time asap");

		                this._timeShowing = false;

		                this.timeTL.clear();
		                this.timeTL.set(this.$.medal, { clearProps: 'zIndex' });
		                this.timeTL.set(this.$.timeShine, { width: 0, clearProps: 'opacity', transition: 'width 325ms ease-in' });
		                this.timeTL.set(this.$.timeClip, {
		                    clearProps: 'webkitClipPath',
		                    transition: '-webkit-clip-path 325ms ease-in'
		                });
		            }
		        }
		    }
		}

		gameAudioChannelsChanged(newVal)
		{
		    if (!newVal || newVal.length <= 0 || this.done == true) 
		    {
		        return;
		    }

		    const channels = newVal[this.index]; 
		    this.audio = !channels.audio.muted;
		}
	}

	customElements.define(RelayTeamPlate.is, RelayTeamPlate);
})();
