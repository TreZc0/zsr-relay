/* global AtomChevron */
(function () {
	'use strict';

	const CHEVRON_WIDTH = 25;
	const CHEVRON_HEIGHT = 45;
	const CHEVRON_THICKNESS = 3;
	const EXPAND_DURATION = 0.678;
	const CONTRACT_DURATION = EXPAND_DURATION;
	const EXPAND_EASE = Power3.easeInOut;
	const CONTRACT_EASE = Power3.easeIn;
	const currentRun = nodecg.Replicant('currentRun');
	var discordserver;

	/**
	 * @customElement
	 * @polymer
	 */
	class ZsrOmnibarCta extends Polymer.Element {
		static get is() {
			return 'zsr-omnibar-cta';
		}

		ready() {
			super.ready();
			const replicants = [
				currentRun
			];

			let numDeclared = 0;
			replicants.forEach(replicant => {
				replicant.once('change', () => {
					numDeclared++;
				});
			});
		currentRun.on('change', this.currentRunChanged.bind(this));

			Polymer.RenderStatus.beforeNextRender(this, () => {
				const chevrons = this.shadowRoot.querySelectorAll('.chevron');
				const bgChevrons = this.shadowRoot.querySelectorAll('.chevron--bg');

				// The chevrons get confused by our `width: 0px` trick on their parents, so
				// we have to manually re-render them at the correct size here.
				chevrons.forEach(chevron => {
					chevron.render(CHEVRON_WIDTH, CHEVRON_HEIGHT);
				});

				bgChevrons.forEach(bgChevron => {
					const gradient = new SVG.Gradient('linear');
					gradient.from(0, 0).to(0, 1);
					gradient.update(stop => {
						stop.at(0, '#052B33');
						stop.at(1, '#040F10');
					});
					bgChevron.svgDoc.add(gradient);
					bgChevron.chevron.fill(gradient.fill());
				});

				this._$chevrons = chevrons;
				this._$bgChevrons = bgChevrons;

				TweenLite.set(this._$chevrons, {scaleY: 0});
			});
		}
		
		currentRunChanged(newVal) {
			if (newVal.discord)
				this.discord = newVal.discord;
			if (newVal.discord) {
				discordserver = true;
			} else discordserver = false;
			if (newVal.discord == "Unknown")
				discordserver = false;
			
			this.name = newVal.name;
			this.category = newVal.category;
		}

		reset() {
			const tl = new TimelineLite();
			tl.set(this._$chevrons, {scaleY: 0});
			tl.set([this.$.leftChevrons, this.$.rightChevrons], {x: 0});
			tl.call(() => {
				this._$chevrons.forEach(chevronElement => {
					const pointArray = AtomChevron.createChevronPointArray({
						width: CHEVRON_THICKNESS,
						height: CHEVRON_HEIGHT, // Doesn't change the height.
						thickness: CHEVRON_THICKNESS // Doesn't change the thickness.
					});
					chevronElement.chevron.plot(pointArray);
				});
			});

			tl.set([this.$.benefitsContent, this.$.standingsContent], {clipPath: 'inset(0 50%)'});
			return tl;
		}

		show(displayDuration) {
			const tl = new TimelineLite();

			tl.add(this.reset());

			tl.to(this._$chevrons, 0.334, {
				scaleY: 1,
				ease: Sine.easeInOut
			});

			// Show first line.
			const benefitsContent = this.$.benefitsContent;
			const benefitsContentWidth = benefitsContent.clientWidth;
			tl.addLabel('expand1');
			tl.to(this.$.leftChevrons, EXPAND_DURATION, {
				x: -(benefitsContentWidth / 2),
				ease: EXPAND_EASE
			}, 'expand1');
			tl.to(this.$.rightChevrons, EXPAND_DURATION, {
				x: benefitsContentWidth / 2,
				ease: EXPAND_EASE
			}, 'expand1');
			tl.add(this.tweenClipPath({
				element: benefitsContent,
				start: 50,
				end: 0,
				duration: EXPAND_DURATION,
				ease: EXPAND_EASE
			}), 'expand1');
			this._$chevrons.forEach(chevron => {
				tl.add(this.bendChevron(chevron, EXPAND_DURATION), 'expand1');
			});
			tl.to(this, displayDuration, {}); // Hold for displayDuration.

			// Hide first line.
			tl.addLabel('contract');
			tl.to([this.$.leftChevrons, this.$.rightChevrons], CONTRACT_DURATION, {
				x: 0,
				ease: CONTRACT_EASE
			}, 'contract');
			tl.add(this.tweenClipPath({
				element: benefitsContent,
				start: 0,
				end: 50,
				duration: CONTRACT_DURATION,
				ease: CONTRACT_EASE
			}), 'contract');
			this._$chevrons.forEach(chevron => {
				tl.add(this.straightenChevron(chevron, CONTRACT_DURATION), 'contract');
			});

			// Show second line.
			const standingsContent = this.$.standingsContent;
			const standingsContentWidth = standingsContent.clientWidth;
			tl.addLabel('expand2');
			tl.to(this.$.leftChevrons, EXPAND_DURATION, {
				x: -(standingsContentWidth / 2),
				ease: Power3.easeOut
			}, 'expand2');
			tl.to(this.$.rightChevrons, EXPAND_DURATION, {
				x: standingsContentWidth / 2,
				ease: Power3.easeOut
			}, 'expand2');
			tl.add(this.tweenClipPath({
				element: standingsContent,
				start: 50,
				end: 0,
				duration: EXPAND_DURATION,
				ease: Power3.easeOut
			}), 'expand2');
			this._$chevrons.forEach(chevron => {
				tl.add(this.bendChevron(chevron, EXPAND_DURATION), 'expand2');
			});
			tl.to(this, displayDuration, {}); // Hold for displayDuration.

			// Hide second line.
			tl.addLabel('contract2');
			tl.to([this.$.leftChevrons, this.$.rightChevrons], CONTRACT_DURATION, {
				x: 0,
				ease: CONTRACT_EASE
			}, 'contract2');
			tl.add(this.tweenClipPath({
				element: standingsContent,
				start: 0,
				end: 50,
				duration: CONTRACT_DURATION,
				ease: CONTRACT_EASE
			}), 'contract2');
			this._$chevrons.forEach(chevron => {
				tl.add(this.straightenChevron(chevron, CONTRACT_DURATION), 'contract2');
			});
			if (discordserver) {
				// Show third line.
				const gamediscordContent = this.$.gamediscordContent;
				const gamediscordContentWidth = gamediscordContent.clientWidth;
				tl.addLabel('expand3');
				tl.to(this.$.leftChevrons, EXPAND_DURATION, {
					x: -(gamediscordContentWidth / 2),
					ease: Power3.easeOut
				}, 'expand3');
				tl.to(this.$.rightChevrons, EXPAND_DURATION, {
					x: gamediscordContentWidth / 2,
					ease: Power3.easeOut
				}, 'expand3');
				tl.add(this.tweenClipPath({
					element: gamediscordContent,
					start: 50,
					end: 0,
					duration: EXPAND_DURATION,
					ease: Power3.easeOut
				}), 'expand3');
				this._$chevrons.forEach(chevron => {
					tl.add(this.bendChevron(chevron, EXPAND_DURATION), 'expand3');
				});
				tl.to(this, displayDuration, {}); // Hold for displayDuration.
				
				// Hide third line.
				tl.addLabel('contract3');
				tl.to([this.$.leftChevrons, this.$.rightChevrons], CONTRACT_DURATION, {
					x: 0,
					ease: CONTRACT_EASE
				}, 'contract3');
				tl.add(this.tweenClipPath({
					element: gamediscordContent,
					start: 0,
					end: 50,
					duration: CONTRACT_DURATION,
					ease: CONTRACT_EASE
				}), 'contract3');
				this._$chevrons.forEach(chevron => {
					tl.add(this.straightenChevron(chevron, CONTRACT_DURATION), 'contract3');
				});
			}
			// Show fourth line.
			const zsrContent = this.$.zsrContent;
			const zsrContentWidth = zsrContent.clientWidth;
			tl.addLabel('expand4');
			tl.to(this.$.leftChevrons, EXPAND_DURATION, {
				x: -(zsrContentWidth / 2),
				ease: Power3.easeOut
			}, 'expand4');
			tl.to(this.$.rightChevrons, EXPAND_DURATION, {
				x: zsrContentWidth / 2,
				ease: Power3.easeOut
			}, 'expand4');
			tl.add(this.tweenClipPath({
				element: zsrContent,
				start: 50,
				end: 0,
				duration: EXPAND_DURATION,
				ease: Power3.easeOut
			}), 'expand4');
			this._$chevrons.forEach(chevron => {
				tl.add(this.bendChevron(chevron, EXPAND_DURATION), 'expand4');
			});
			tl.to(this, displayDuration, {}); // Hold for displayDuration.
			
			// Hide fourth line.
			tl.addLabel('contract4');
			tl.to([this.$.leftChevrons, this.$.rightChevrons], CONTRACT_DURATION, {
				x: 0,
				ease: CONTRACT_EASE
			}, 'contract4');
			tl.add(this.tweenClipPath({
				element: zsrContent,
				start: 0,
				end: 50,
				duration: CONTRACT_DURATION,
				ease: CONTRACT_EASE
			}), 'contract4');
			this._$chevrons.forEach(chevron => {
				tl.add(this.straightenChevron(chevron, CONTRACT_DURATION), 'contract4');
			});		
			
			// Show fifth line.
			const apparelContent = this.$.apparelContent;
			const apparelContentWidth = apparelContent.clientWidth;
			tl.addLabel('expand5');
			tl.to(this.$.leftChevrons, EXPAND_DURATION, {
				x: -(apparelContentWidth / 2),
				ease: Power3.easeOut
			}, 'expand5');
			tl.to(this.$.rightChevrons, EXPAND_DURATION, {
				x: apparelContentWidth / 2,
				ease: Power3.easeOut
			}, 'expand5');
			tl.add(this.tweenClipPath({
				element: apparelContent,
				start: 50,
				end: 0,
				duration: EXPAND_DURATION,
				ease: Power3.easeOut
			}), 'expand5');
			this._$chevrons.forEach(chevron => {
				tl.add(this.bendChevron(chevron, EXPAND_DURATION), 'expand5');
			});
			tl.to(this, displayDuration, {}); // Hold for displayDuration.
			
			// Hide fifth line.
			tl.addLabel('contract5');
			tl.to([this.$.leftChevrons, this.$.rightChevrons], CONTRACT_DURATION, {
				x: 0,
				ease: CONTRACT_EASE
			}, 'contract5');
			tl.add(this.tweenClipPath({
				element: apparelContent,
				start: 0,
				end: 50,
				duration: CONTRACT_DURATION,
				ease: CONTRACT_EASE
			}), 'contract5');
			this._$chevrons.forEach(chevron => {
				tl.add(this.straightenChevron(chevron, CONTRACT_DURATION), 'contract5');
			});	
			
			// Exit.
			tl.to(this._$chevrons, 0.334, {
				scaleY: 0,
				ease: Sine.easeInOut,
				callbackScope: this,
				onStart() {
					this.$.lineSelector.selected = '';
				}
			});

			return tl;
		}

		straightenChevron(chevronElement, duration = 1) {
			const tl = new TimelineLite();
			const proxy = {width: CHEVRON_WIDTH};
			tl.to(proxy, duration, {
				width: CHEVRON_THICKNESS,
				ease: Sine.easeInOut,
				autoRound: false,
				onUpdate() {
					const pointArray = AtomChevron.createChevronPointArray({
						width: proxy.width,
						height: CHEVRON_HEIGHT, // Doesn't change the height.
						thickness: CHEVRON_THICKNESS // Doesn't change the thickness.
					});
					chevronElement.chevron.plot(pointArray);
				}
			});
			return tl;
		}

		bendChevron(...args) {
			const tl = this.straightenChevron(...args);
			tl.reverse(0);
			return tl;
		}

		tweenClipPath({element, start, end, duration, ease}) {
			const proxy = {percentage: start};
			return TweenLite.to(proxy, duration, {
				percentage: end,
				ease,
				callbackScope: this,
				onStart() {
					this.$.lineSelector.selected = element.parentNode.id;
				},
				onUpdate() {
					element.style.clipPath = `inset(0 calc(${proxy.percentage}% - 7px)`;
				}
			});
		}
	}

	customElements.define(ZsrOmnibarCta.is, ZsrOmnibarCta);
})();
