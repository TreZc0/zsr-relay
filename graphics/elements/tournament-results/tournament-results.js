(function () {
    'use strict';

    const runners = nodecg.Replicant('runners', 'zsr-tournament');
    const leaderboard = nodecg.Replicant('leaderboard', 'zsr-tournament');
	const currentRun = nodecg.Replicant('currentRun', 'zsr-tournament');

    class TournamentResults extends Polymer.Element {
        static get is() {
            return 'tournament-results';
        }

        static get properties() {
            return {
                resultList: {
                    type: Array,
                    reflectToAttribute: true,
                    value: []
                }
            };
        }

		ready () {
			super.ready();

			/*
			var rootDom = Polymer.dom(this.root);

			var grid = rootDom.querySelector('#rounded-rows');

			grid.items = new Array({ name: 'test', stream: 'fick' }, { field_a: 'AAA2', field_b: 'BBB2' });

			grid.selectedItems = grid.items;

			grid.addColumn("tets").setCaption("Name");
			*/

			/*
			Grid grid = new Grid("My data grid");
			layout.addComponent(grid);
			grid.setSizeFull();
			layout.setExpandRatio(grid, 1);
			grid.setItems({ name: "db" });

			countryGrid
				.addComponentColumn(country -> new Label(country.getFullName()))
				.setCaption("Name");

			countryGrid.setRowHeight(40);


						var inputRenderer = function (cell) {
							if (cell.element.childElementCount === 0) {
								cell.element.innerHTML = '';
								var input = document.createElement('paper-input');
								cell.element.appendChild(input);
							}

							cell.element.children[0].value = cell.data;
						};

						grid.columns[0].renderer = inputRenderer;

			*/

            const replicants =
                [
                    runners,
					leaderboard,
					currentRun
                ];

            let numDeclared = 0;
            replicants.forEach(replicant => {
                replicant.once('change', () => {
                    numDeclared++;

                    // Start the loop once all replicants are declared
                    if (numDeclared >= replicants.length) {

                        runners.on('change', newVal => {

                            if (!newVal)
                                return;

                            if (newVal.length == 0)
                                return;
                        });
						currentRun.on('change', newVal => {
							this.$.title.innerText = newVal.name + " - " + newVal.category;
							this.$.subtitle.innerText = newVal.round;
						});
						
                        leaderboard.on('change', newVal => {

                            if (!newVal)
								return;

							var newResults = this.resultList;
							this.resultList = [];

							newResults = [];

							//Ranking list is ordered Finished-Running-Forfeit

							//Finished Runners
                            newVal.ranking.forEach(finishedRunner => {

								console.log("EXTERNAL-LOG: " + finishedRunner.name + " has finished in place " + finishedRunner.place + "!");

								if (finishedRunner.status === "Finished")
									newResults.push(finishedRunner);
							});

							//Active Runners
							runners.value.forEach(runner => {

								let alreadyIn = newVal.ranking.find(finishedRunner => {

									if (finishedRunner.stream === runner.stream)
										return true;

									return false;
								});

								if (!alreadyIn)
								{
									console.log("hasnt finished yet, add runner");
									newResults.push({ name: runner.name, stream: runner.stream, status: "Running", place: "", timeFormat: "" });
								}

							});

							//Quitters
							newVal.ranking.forEach(finishedRunner => {

								if (finishedRunner.status === "Forfeit")
									newResults.push({ name: finishedRunner.name, stream: finishedRunner.stream, status: "Forfeit", place: "-", timeFormat: "" });
							});

                    
							this.resultList = newResults;
                        });
                    }
                });
            });
        }
    }
    
    customElements.define(TournamentResults.is, TournamentResults);

})();
