(function (App) {
	'use strict';

	App.labDatabase = [];

	App.normalizeLabKey = function (value) {
		return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
	};

	App.normalizeLabNumber = function (value) {
		if (value === undefined || value === null || value === '') return null;
		var normalized = String(value).trim().replace(',', '.').replace(/[^0-9.+-]/g, '');
		var number = Number(normalized);
		return Number.isFinite(number) ? number : null;
	};

	App.normalizeLabDate = function (value) {
		if (value instanceof Date && !Number.isNaN(value.getTime())) {
			return value.toISOString().slice(0, 10);
		}
		if (typeof value === 'number' && /^\d{8}$/.test(String(value))) {
			var compactDate = String(value);
			return compactDate.slice(4) + '-' + compactDate.slice(2, 4) + '-' + compactDate.slice(0, 2);
		}
		if (typeof value === 'number' && window.XLSX && window.XLSX.SSF) {
			var parsed = window.XLSX.SSF.parse_date_code(value);
			if (parsed) {
				return parsed.y + '-' + String(parsed.m).padStart(2, '0') + '-' + String(parsed.d).padStart(2, '0');
			}
		}
		var text = String(value ?? '').trim();
		var match = text.match(/^(\d{2})(\d{2})(\d{4})$/);
		if (match) return match[3] + '-' + match[2] + '-' + match[1];
		match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
		if (match) {
			return match[3] + '-' + match[2].padStart(2, '0') + '-' + match[1].padStart(2, '0');
		}
		match = text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
		return match
			? match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0')
			: text;
	};

	App.getLabValue = function (row, aliases) {
		var entry = Object.entries(row).find(function (pair) {
			return aliases.includes(App.normalizeLabKey(pair[0]));
		});
		return entry ? entry[1] : null;
	};

	App.importLabHistoryFromExcel = function () {
		var currentPatient = App.normalizeLabKey(App.dom.patientInput.value);
		if (!currentPatient) return 0;

		var importedRecords = App.labDatabase
			.filter(function (entry) { return entry.patient === currentPatient; })
			.map(App.labEntryToRecord)
			.filter(Boolean)
			.sort(function (a, b) { return a.date.localeCompare(b.date); });

		if (!importedRecords.length) return 0;

		App.state.records = importedRecords;
		App.setAssessmentDate(importedRecords[importedRecords.length - 1].date);
		App.saveLocally();
		App.renderLiveScore();
		App.renderHistory();
		return importedRecords.length;
	};

	App.applyLabValuesIfAvailable = function () {
		var currentPatient = App.normalizeLabKey(App.dom.patientInput.value);
		var currentDate = App.getAssessmentDate();

		if (!currentPatient) return;

		var match = App.labDatabase.find(function (entry) {
			return entry.patient === currentPatient && entry.date === currentDate;
		});
		if (!match) return;

		var respVal = App.mapHorovitzToSofa(match.horovitz);
		var coagVal = App.mapPlateletsToSofa(match.platelets);
		var liverVal = App.mapBilirubinToSofa(match.bilirubin);
		var renalVal = App.mapRenalToSofa(match.creatinine, match.urine);
		var cardioVal = App.mapCardioToSofa(match.map, match.noradrenalin, match.dopamine);
		var cnsVal = App.mapCnsToSofa(match.gcs);

		if (respVal !== null) document.getElementById('respiration').value = respVal;
		if (coagVal !== null) document.getElementById('coagulation').value = coagVal;
		if (liverVal !== null) document.getElementById('liver').value = liverVal;
		if (renalVal !== null) document.getElementById('renal').value = renalVal;
		if (cardioVal !== null) document.getElementById('cardiovascular').value = cardioVal;
		if (cnsVal !== null) document.getElementById('cns').value = cnsVal;
		App.renderLiveScore();
	};

	App.bindLabImport = function () {
		document.getElementById('btnUploadLab').addEventListener('click', function () {
			document.getElementById('labFileInput').click();
		});

		document.getElementById('labFileInput').addEventListener('change', function (e) {
			var file = e.target.files[0];
			if (!file) return;

			var reader = new FileReader();
			reader.onload = function (evt) {
				try {
					var data = new Uint8Array(evt.target.result);
					var workbook = XLSX.read(data, { type: 'array', cellDates: true });

					App.labDatabase = [];
					workbook.SheetNames.forEach(function (sheetName) {
						var rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
							defval: null,
							raw: true
						});
						rows.forEach(function (row) {
							var patient = App.getLabValue(row, [
								'patient', 'patientid', 'patientenid', 'patientfallid',
								'fallid', 'fallnummer', 'patientennummer'
							]) || sheetName;
							App.labDatabase.push({
								patient: App.normalizeLabKey(patient),
								date: App.normalizeLabDate(App.getLabValue(row, [
									'datum', 'date', 'erhebungsdatum', 'messdatum'
								])),
								horovitz: App.getLabValue(row, ['horovitz', 'pao2fio2', 'pao2f i o2']),
								platelets: App.getLabValue(row, ['thrombozyten', 'platelets', 'plt']),
								bilirubin: App.getLabValue(row, ['bilirubin', 'bilirubinmgdl']),
								creatinine: App.getLabValue(row, ['kreatinin', 'creatinine']),
								urine: App.getLabValue(row, ['urin', 'urinausscheidung', 'urine']),
								map: App.getLabValue(row, ['map', 'mittlererarteriellerdruck']),
								noradrenalin: App.getLabValue(row, ['noradrenalin', 'norepinephrin']),
								dopamine: App.getLabValue(row, ['dopamin', 'dopamine']),
								gcs: App.getLabValue(row, ['gcs', 'glasgowcomascale'])
							});
						});
					});

					var importedRecords = App.importLabHistoryFromExcel();
					alert(
						'Labordaten erfolgreich importiert!\nGefundene Patienten: ' +
						workbook.SheetNames.join(', ') +
						'\nÜbernommene Tageswerte: ' + importedRecords
					);
					App.applyLabValuesIfAvailable();
				} catch (err) {
					console.error('Fehler beim Excel-Import:', err);
					alert('Die Datei konnte nicht gelesen werden. Bitte Format prüfen.');
				}
			};
			reader.readAsArrayBuffer(file);
			e.target.value = '';
		});
	};
})(window.SofaApp = window.SofaApp || {});
