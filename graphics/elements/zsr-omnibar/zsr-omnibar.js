(function () {
	'use strict';

	// Configuration consts.
	const DISPLAY_DURATION = nodecg.bundleConfig.displayDuration;
	const SCROLL_HOLD_DURATION = nodecg.bundleConfig.omnibar.scrollHoldDuration;

	// Replicants.
	const currentLayout = nodecg.Replicant('zsr:currentLayout');
	const currentRun = nodecg.Replicant('currentRun');
	const nextRun = nodecg.Replicant('nextRun');
	const schedule = nodecg.Replicant('schedule');
	const raceLeaderboard = nodecg.Replicant('leaderboard');

	class ZsrOmnibar extends Polymer.Element {
		static get is() {
			return 'zsr-omnibar';
		}

		static get properties() {
			return {
				importPath: String, // https://github.com/Polymer/polymer-linter/issues/71
			};
		}

		ready() {
			super.ready();

			const replicants = [
				currentRun,
				nextRun,	
				schedule,
				raceLeaderboard
			];

			let numDeclared = 0;
			replicants.forEach(replicant => {
				replicant.once('change', () => {
					numDeclared++;

					// Start the loop once all replicants are declared;
					if (numDeclared >= replicants.length) {
						Polymer.RenderStatus.beforeNextRender(this, this.run);
					}
				});
			});
		}

		run() {
			const self = this;

			// For development, comment out whichever parts you don't want to see right now.
			const parts = [
				this.showCTA,
				this.showRaceLeaderboard
			];

			function processNextPart() {
				if (parts.length > 0) {
					const part = parts.shift().bind(self);
					promisifyTimeline(part())
						.then(processNextPart)
						.catch(error => {
							nodecg.log.error('Error when running main loop:', error);
						});
				} else {
					self.run();
				}
			}

			function promisifyTimeline(tl) {
				return new Promise(resolve => {
					tl.call(resolve, null, null, '+=0.03');
				});
			}

			processNextPart();
		}

		/**
		 * Creates an animation timeline for showing the label.
		 * @param {String} text - The text to show.
		 * @param {LabelShowAndChangeOptions} [options={}] - Options for this animation.
		 * @returns {TimelineLite} - An animation timeline.
		 */
		showLabel(text, options = {}) {
			const tl = new TimelineLite();
			options.flagHoldDuration = Math.max(DISPLAY_DURATION / 2, 5);
			if (this.$.label._showing) {
				tl.add(this.$.label.change(text, options));
			} else {
				tl.add(this.$.label.show(text, options));
			}

			return tl;
		}

		/**
		 * Creates an animation timeline for hiding the label.
		 * @returns {TimelineLite} - An animation timeline.
		 */
		hideLabel() {
			return this.$.label.hide();
		}

		setContent(tl, element) {
			tl.to({}, 0.03, {}); // Safety buffer to avoid issues where GSAP might skip our `call`.
			tl.call(() => {
				tl.pause();
				this.$.content.innerHTML = '';
				this.$.content.appendChild(element);
				Polymer.flush(); // Might not be necessary, but better safe than sorry.
				Polymer.RenderStatus.afterNextRender(this, () => {
					Polymer.flush(); // Might not be necessary, but better safe than sorry.
					requestAnimationFrame(() => {
						tl.resume(null, false);
					});
				});
			});
		}

		showContent(tl, element) {
			tl.to({}, 0.03, {}); // Safety buffer to avoid issues where GSAP might skip our `call`.
			tl.call(() => {
				tl.pause();
				const elementEntranceAnim = element.enter(DISPLAY_DURATION, SCROLL_HOLD_DURATION);
				elementEntranceAnim.call(tl.resume, null, tl);
			});
		}

		hideContent(tl, element) {
			tl.to({}, 0.03, {}); // Safety buffer to avoid issues where GSAP might skip our `call`.
			tl.call(() => {
				tl.pause();
				const elementExitAnim = element.exit();
				elementExitAnim.call(tl.resume, null, tl);
			});
		}

		showCTA() {
			const tl = new TimelineLite();
			tl.add(this.hideLabel());
			tl.call(() => {
				this.$.content.innerHTML = '';
			});
			tl.add(this.$.cta.show(DISPLAY_DURATION));
			return tl;
		}
		
		showRaceLeaderboard() {
			const tl = new TimelineLite();
			if (!raceLeaderboard.value || !raceLeaderboard.value.ranking || raceLeaderboard.value.ranking.length == 0) {
				console.log
				return tl;
			}

			let rankingCount = 0;
			const listElement = document.createElement('zsr-omnibar-list');

			raceLeaderboard.value.ranking.forEach(rank => {

				if (rank.status != "Forfeit") {
					rankingCount++;

					const element = document.createElement('zsr-omnibar-rank');
					element.rank = { rankName: rank.place + ". " + rank.name, time: rank.timeFormat };

					if (rank.place == 1) {
						element.first = true;
					} else if (rank.place == 2) {
						element.second = true;
					} else if (rank.place == 3) {
						element.third = true;
					}

					listElement.appendChild(element);
				}			
			});

			if (rankingCount == 0)
				return tl;

			raceLeaderboard.value.ranking.forEach(rank => {

				if (rank.status === "Forfeit") {
	
					const element = document.createElement('zsr-omnibar-rank');
					element.rank = { rankName: "-. " + rank.name, time: "Forfeit" };
					element.forfeit = true;

					listElement.appendChild(element);
				}
			});

			this.setContent(tl, listElement);

			tl.add(this.showLabel('Rankings', {
				avatarIconName: 'finish',
				flagColor: '#57ffeb',
				ringColor: '#1cffe3'
			}), '+=0.03');

			this.showContent(tl, listElement);
			this.hideContent(tl, listElement);

			return tl;
		}

	}

	customElements.define(ZsrOmnibar.is, ZsrOmnibar);
})();
