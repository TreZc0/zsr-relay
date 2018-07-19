(function () {
	'use strict';

	const ONE_THOUSAND = 1000;

	class ZsrOmnibarMilestoneTrackerPoint extends Polymer.Element {
		static get is() {
			return 'zsr-omnibar-milestone-tracker-point';
		}

		static get properties() {
			return {
				align: {
					type: String,
					value: 'left',
					reflectToAttribute: true,
					observer: '_alignChanged'
				},
				amount: Number,
				dropTrailingZeroes: {
					type: Boolean,
					value: false
				}
			};
		}

		_alignChanged(newVal) {
			if (newVal !== 'center') {
				this.$.body.style.left = '';
			}

			const bodyRect = this.$.body.getBoundingClientRect();
			this.$.body.style.left = `${(bodyRect.width / -2) + 1.5}px`;
		}

		_calcDisplayAmount(amount) {
			if (this._formatAmount(amount / ONE_THOUSAND) == "0")
				return `$${this._formatAmount(amount / ONE_THOUSAND)}`;
			else 
				return `$${this._formatAmount(amount / ONE_THOUSAND)}K`;
		}

		_formatAmount(amount) {
			let amountString = String(amount).substr(0, 4);

			if (this.dropTrailingZeroes) {
				while (
					(amountString.endsWith('0') || amountString.endsWith('.')) &&
					amountString.length > 1
				) {
					amountString = amountString.slice(0, -1);
				}
			}
			return amountString;
			}
	}

	customElements.define(ZsrOmnibarMilestoneTrackerPoint.is, ZsrOmnibarMilestoneTrackerPoint);
})();
