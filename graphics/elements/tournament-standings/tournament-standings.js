(function() {
    'use strict';

    const runners = nodecg.Replicant('runners', 'zsr-tournament');
    const leaderboard = nodecg.Replicant('leaderboard', 'zsr-tournament');
	var jsonData;
    class TournamentStandings extends Polymer.Element {
        static get is() {
            return 'tournament-standings';
        }

        static get properties() {
            return {
				items: {
                    type: Array,
                    value: []
                },
                page: {
                    type: Number,
					observer: 'pageChanged'
                },
                pages: {
                    type: Array,
                    value: []
                }
            };
        }

		ready () {
            super.ready();

			var jsonFile = '../../../../external-assets/graphics/img/standings/standings.json';
            $.ajax({
                url: jsonFile,
                async: false,
                dataType: 'json',
                success: function (data) {
                    console.log("success");
                    jsonData = data;
                }
            });
            console.log(jsonData);
			this.pages.length = 0;
            this.pages = Array.apply(null, {length: Math.ceil(jsonData.tournament[0].raceCount / this.$.master.pageSize)} ).map(function(item, index) {
              return index + 1;
            });
          
            this.page = 0;
        }
			
		_isSelected (page, item) {
          return page === item - 1;
        }

        _select (e) {
          this.page = e.model.item - 1;
        }

        _next () {
          this.page = Math.min(this.pages.length - 1, this.page + 1);
		  console.log("next works");
        }

        _prev () {
          this.page = Math.max(0, this.page - 1);
		  console.log("prev works");
		  }
		
        pageChanged(page)
        {
            var start = page * this.$.master.pageSize;
            var end = (page + 1) * this.$.master.pageSize;

            this.items = jsonData.tournament.slice(start, end);

            /*this.items.forEach(result => {

                //adjust date
                let msec = Date.parse(result.date);
                let racedate = new Date(msec)
                result.date = racedate.toUTCString();

                //wenn wir noch irgendwas anderes brauchen für die tabelle an werten, dann hier. das für jedes race ausgeführt, daher sollten wir das wirklich auf 10 max beschränken per seite und dafür sorgen das das ranking display fertig ist und hier nicht angepasst werden muss auch noch für alle runner, weil das sich dann schnell multipliziert
            });*/

            this.$.master.items = this.items;
        }
    }
    
    customElements.define(TournamentStandings.is, TournamentStandings);

})();
