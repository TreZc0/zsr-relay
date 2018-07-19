/**
 * @customElement
 * @polymer
 */
class ZsrOmnibarChallenges extends Polymer.Element {
	static get is() {
		return 'zsr-omnibar-challenges';
	}

	static get properties() {
		return {
			challenges: Array
		};
	}

	enter(displayDuration, scrollHoldDuration) {
		const tl = new TimelineLite();

		this.challenges.forEach((challenge, index) => {
			const challengeElement = document.createElement('zsr-omnibar-challenge');
			challengeElement.classList.add('challenge');
			challengeElement.bid = challenge;
			this.$.challenges.appendChild(challengeElement);

			tl.call(() => {
				this.$.challenges.select(index);
			}, null, null, '+=0.03');

			if (index === 0) {
				tl.add(this.$.label.enter(challenge.description + "<br>" +challenge.speedrun));

			} else {
				tl.add(this.$.label.change(challenge.description + "<br>" + challenge.speedrun));
			}

			tl.call(() => {
				tl.pause();
				challengeElement.render();
				const tempTl = challengeElement.enter(displayDuration, scrollHoldDuration);
				tempTl.call(tl.resume, null, tl);
			});

			tl.call(() => {
				tl.pause();
				const tempTl = challengeElement.exit();
				tempTl.call(tl.resume, null, tl);
			}, null, null, `+=${displayDuration}`);
		});

		return tl;
	}

	exit() {
		const tl = new TimelineLite();
		tl.add(this.$.label.exit());
		return tl;
	}
}

customElements.define(ZsrOmnibarChallenges.is, ZsrOmnibarChallenges);
