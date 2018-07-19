/**
 * @customElement
 * @polymer
 */
class ZsrOmnibarRank extends Polymer.Element {
	static get is() {
		return 'zsr-omnibar-rank';
	}

	static get properties() {
		return {
			rank: Object,
			first: {
				type: Boolean,
				reflectToAttribute: true
			},
			second: {
				type: Boolean,
				reflectToAttribute: true
			},
			third: {
				type: Boolean,
				reflectToAttribute: true
			},
			forfeit: {
				type: Boolean,
				reflectToAttribute: true
			}
		};
	}

	enter() {
		return this.$.listItem.enter();
	}

	exit() {
		return this.$.listItem.exit();
	}
}

customElements.define(ZsrOmnibarRank.is, ZsrOmnibarRank);
