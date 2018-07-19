(function () {
	'use strict';

	const currentRun = nodecg.Replicant('currentRun');

	
	class InterviewNameplate extends Polymer.MutableData(Polymer.Element) {
		static get is() {
			return 'interview-nameplate';
		}

		static get properties() {
		    return {
				platename: {
					type: String
				},
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
					if (numDeclared >= replicants.length) {

						currentRun.on('change', newVal => {
							const runner = newVal.runners[this.index];
							if (runner.name.endsWith("s")) {
								this.name = runner.name +"’\n";
							} else {
								this.name = runner.name +"’s\n";
							}								

								
						});			
					}
				});
			});
		
		}
	
	}

	customElements.define(InterviewNameplate.is, InterviewNameplate);
})();
