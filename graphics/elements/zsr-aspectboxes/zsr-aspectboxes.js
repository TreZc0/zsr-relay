(function () {
	'use strict';
	const currentRun = nodecg.Replicant('currentRun');

	class ZsrAspectBoxes extends Polymer.Element {
		static get is() {
			return 'zsr-aspectboxes';
		}

		static get properties() {
			return {
				index: Number
			};
		}

		ready() {
			super.ready();
			const replicants =
			[
				currentRun
			];

			let numDeclared = 0;
			replicants.forEach(replicant => {
			    replicant.once('change', () => {
			        numDeclared++;

			        // Start the loop once all replicants are declared
			        if (numDeclared >= replicants.length)
			        {
			            currentRun.on('change', this.currentRunChanged.bind(this));
			        }
			    });
			});
		}

		currentRunChanged(newVal, oldVal)
		{
			// If nothing has changed, do nothing.
			if (oldVal && JSON.stringify(newVal.runners) === JSON.stringify(oldVal.runners)) {
				return;
			}
			if ((newVal.runners[this.index].game.toLowerCase() == "tphd") || (newVal.runners[this.index].game.toLowerCase() == "twwhd"))
				this.$.aspectbox.style.display = "none";
			else this.$.aspectbox.style.display = "initial";    
		}
		
	}
	customElements.define(ZsrAspectBoxes.is, ZsrAspectBoxes);
})();
