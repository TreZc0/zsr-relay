/**
 * @customElement
 * @polymer
 */
class ZsrOmnibarRun extends Polymer.Element {
	static get is() {
		return 'zsr-omnibar-run';
	}

	static get properties() {
		return {
			run: Object,
			first: {
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

	formatName(name) {
		return name.replace('\\n', ' ').trim();
	}

	concatenateRunners(run) {

		let concatenatedRunners = run.runners[0].name;
		if (run.runners.length > 1) {
			concatenatedRunners = run.runners.slice(1).reduce((prev, curr, index, array) => {
				if (index === array.length - 1) {
					return `${prev} & ${curr.name}`;
				}

				return `${prev}, ${curr.name}`;
			}, concatenatedRunners);
		}
		if (run.pk === 11) {
			concatenatedRunners = 'Open Signups!';
		}
		if (run.pk === 25) {
			concatenatedRunners = 'Donate for Bonus Game!';
		}
		return concatenatedRunners;
	}
}

customElements.define(ZsrOmnibarRun.is, ZsrOmnibarRun);
