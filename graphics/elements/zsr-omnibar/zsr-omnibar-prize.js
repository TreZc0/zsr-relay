/**
 * @customElement
 * @polymer
 */
class ZsrOmnibarPrize extends Polymer.Element {
	static get is() {
		return 'zsr-omnibar-prize';
	}

	static get properties() {
		return {
			prize: Object
		};
	}

	enter() {
		return this.$.listItem.enter();
	}

	exit() {
		return this.$.listItem.exit();
	}

	calcBidAmountText(prize) {
		return prize.sumdonations ?
			`${prize.minimumbid} in Total Donations` :
			`${prize.minimumbid} Single Donation`;
	}
}

customElements.define(ZsrOmnibarPrize.is, ZsrOmnibarPrize);
