(function (App) {
	'use strict';

	App.fields = ['respiration', 'coagulation', 'liver', 'cardiovascular', 'cns', 'renal'];

	App.fieldLabelMap = {
		respiration: 'respPoints',
		coagulation: 'coagPoints',
		liver: 'liverPoints',
		cardiovascular: 'cardioPoints',
		cns: 'cnsPoints',
		renal: 'renalPoints'
	};

	App.mapHorovitzToSofa = function (paO2FiO2) {
		var v = App.normalizeLabNumber(paO2FiO2);
		if (v === null) return null;
		if (v >= 400) return '0';
		if (v >= 300) return '1';
		if (v >= 200) return '2';
		// Bei Werten unter 200: Standardmäßig Stufe 2 oder 3 vorschlagen (Beatmung manuell anpassbar)
		return '2';
	};

	App.mapPlateletsToSofa = function (plt) {
		var v = App.normalizeLabNumber(plt);
		if (v === null) return null;
		if (v >= 150) return '0';
		if (v >= 100) return '1';
		if (v >= 50) return '2';
		if (v >= 20) return '3';
		return '4';
	};

	App.mapBilirubinToSofa = function (bili) {
		var v = App.normalizeLabNumber(bili);
		if (v === null) return null;
		if (v < 1.2) return '0';
		if (v <= 1.9) return '1';
		if (v <= 5.9) return '2';
		if (v <= 11.9) return '3';
		return '4';
	};

	App.mapRenalToSofa = function (crea, urine) {
		var normalizedUrine = App.normalizeLabNumber(urine);
		if (normalizedUrine !== null) {
			var u = normalizedUrine;
			if (u < 200) return '4';
			if (u < 500) return '3';
		}
		var c = App.normalizeLabNumber(crea);
		if (c === null) return null;
		if (c < 1.2) return '0';
		if (c <= 1.9) return '1';
		if (c <= 3.4) return '2';
		if (c <= 4.9) return '3';
		return '4';
	};

	App.mapCardioToSofa = function (mapVal, norVal, dopaVal) {
		var nor = App.normalizeLabNumber(norVal) ?? 0;
		var dopa = App.normalizeLabNumber(dopaVal) ?? 0;
		var map = App.normalizeLabNumber(mapVal);

		// Stufe 4: Dopamin > 15 oder Noradrenalin/Adrenalin > 0.1
		if (dopa > 15 || nor > 0.1) return '4';

		// Stufe 3: Dopamin > 5 bis 15 oder Noradrenalin/Adrenalin <= 0.1
		if (dopa > 5 || nor > 0) return '3';

		// Stufe 2: Dopamin <= 5 (bei laufender Katecholamintherapie)
		if (dopa > 0) return '2';

		// Stufe 1 oder 0 anhand des MAP (wenn keine Vasopressoren laufen)
		if (map !== null) {
			if (map < 70) return '1';
			return '0';
		}

		return null;
	};

	App.mapCnsToSofa = function (gcsVal) {
		var gcs = App.normalizeLabNumber(gcsVal);
		if (gcs === null) return null;

		if (gcs >= 15) return '0';
		if (gcs >= 13) return '1';
		if (gcs >= 10) return '2';
		if (gcs >= 6) return '3';
		return '4'; // GCS < 6
	};

	App.labEntryToRecord = function (entry) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return null;

		var values = [
			App.mapHorovitzToSofa(entry.horovitz),
			App.mapPlateletsToSofa(entry.platelets),
			App.mapBilirubinToSofa(entry.bilirubin),
			App.mapCardioToSofa(entry.map, entry.noradrenalin, entry.dopamine),
			App.mapCnsToSofa(entry.gcs),
			App.mapRenalToSofa(entry.creatinine, entry.urine)
		];
		if (values.every(function (value) { return value === null; })) return null;

		return {
			date: entry.date,
			score: values.reduce(function (sum, value) {
				return sum + (value === null ? 0 : Number(value));
			}, 0)
		};
	};

	App.score = function () {
		return App.fields.reduce(function (sum, field) {
			return sum + Number(document.getElementById(field).value);
		}, 0);
	};

	App.tone = function (value, delta) {
		if (value >= 2 || delta >= 2) {
			return { className: 'red', label: value + ' · erhöhte Organfunktionsstörung' };
		}
		if (value === 1 || delta === 1) {
			return { className: 'yellow', label: value + ' · leichte Zunahme' };
		}
		return { className: 'green', label: '0 · keine Zunahme' };
	};

	App.getPreviousRecord = function (date) {
		for (var index = App.state.records.length - 1; index >= 0; index -= 1) {
			if (App.state.records[index].date < date) return App.state.records[index];
		}
		return null;
	};
})(window.SofaApp = window.SofaApp || {});
