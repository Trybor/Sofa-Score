(function (App) {
	'use strict';

	App.state = { records: [] };
	App.today = new Date().toISOString().slice(0, 10);

	App.ensurePatientId = function () {
		if (App.dom.patientInput.value.trim()) return true;
		App.dom.patientInput.focus();
		App.dom.patientInput.setCustomValidity('Bitte eine Patienten- oder Fall-ID eingeben.');
		App.dom.patientInput.reportValidity();
		App.dom.patientInput.setCustomValidity('');
		return false;
	};

	App.ensureWard = function () {
		if (App.dom.wardInput.value.trim()) return true;
		App.dom.wardInput.focus();
		App.dom.wardInput.setCustomValidity('Bitte zuerst eine Station auswählen.');
		App.dom.wardInput.reportValidity();
		App.dom.wardInput.setCustomValidity('');
		return false;
	};

	App.ensureRecords = function () {
		if (App.state.records.length) return true;
		alert('Bitte zuerst mindestens einen Tageswert speichern.');
		return false;
	};

	App.getAssessmentDate = function () {
		return App.normalizeLabDate(App.dom.dateInput.value);
	};

	App.setAssessmentDate = function (isoDate) {
		var match = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
		App.dom.datePickerInput.value = match ? isoDate : '';
		App.dom.dateDropdownTrigger.textContent = match
			? match[3] + match[2] + match[1]
			: 'Datum auswählen';
	};

	App.shiftAssessmentDate = function (days) {
		var current = new Date((App.getAssessmentDate() || App.today) + 'T12:00:00');
		current.setDate(current.getDate() + days);
		App.setAssessmentDate(current.toISOString().slice(0, 10));
		App.renderLiveScore();
		App.applyLabValuesIfAvailable();
		App.dom.dateDropdown.open = false;
	};

	App.renderLiveScore = function () {
		var current = App.score();
		var assessmentDate = App.getAssessmentDate();
		var prevRecord = App.getPreviousRecord(assessmentDate);
		var prevScore = prevRecord ? prevRecord.score : null;
		var delta = prevScore === null ? 0 : current - prevScore;
		var status = App.tone(current, delta);

		document.getElementById('currentScore').textContent = current;
		document.getElementById('firstScore').textContent = prevScore === null ? '–' : prevScore;
		document.getElementById('deltaScore').textContent = (delta > 0 ? '+' : '') + delta;

		var statusEl = document.getElementById('currentStatus');
		statusEl.className = 'score-status ' + status.className;
		statusEl.textContent = status.label;

		document.getElementById('scoreCard').className = 'score-card ' + status.className;

		App.fields.forEach(function (field) {
			document.getElementById(App.fieldLabelMap[field]).textContent =
				document.getElementById(field).value;
		});

		document.getElementById('dateBadge').textContent = new Date(
			assessmentDate + 'T12:00:00'
		).toLocaleDateString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	};

	App.renderHistory = function () {
		var container = document.getElementById('historyContainer');
		if (!App.state.records.length) {
			container.innerHTML = '<div class="empty">Noch keine Tageswerte gespeichert.</div>';
			return;
		}

		var tableBlock =
			'<table class="history-table"><thead><tr><th>Datum</th><th>SOFA gesamt</th><th>Delta</th><th>Dokumentation</th></tr></thead><tbody>' +
			App.state.records.map(function (record, index) {
				var delta = index > 0 ? record.score - App.state.records[index - 1].score : 0;
				var status = App.tone(record.score, delta);
				return (
					'<tr><td>' +
					new Date(record.date + 'T12:00:00').toLocaleDateString('de-DE') +
					'</td><td><span class="score-pill ' + status.className + '">' + record.score +
					'</span></td><td>' + (delta > 0 ? '+' : '') + delta + '</td><td>' +
					(index === 0 ? 'Basiswert (Start)' : 'Tageswert vs. Vortag') +
					'</td></tr>'
				);
			}).join('') +
			'</tbody></table>';

		container.innerHTML = tableBlock + App.renderChartBlock(App.state.records);
	};

	App.init = function () {
		App.dom = {
			patientInput: document.getElementById('patient'),
			wardInput: document.getElementById('ward'),
			datePickerInput: document.getElementById('assessmentDatePicker'),
			dateDropdown: document.getElementById('dateDropdown'),
			dateDropdownTrigger: document.getElementById('dateDropdownTrigger'),
			previousAssessmentDateButton: document.getElementById('previousAssessmentDate'),
			todayAssessmentDateButton: document.getElementById('todayAssessmentDate'),
			nextAssessmentDateButton: document.getElementById('nextAssessmentDate')
		};
		App.dom.dateInput = App.dom.datePickerInput;

		App.setAssessmentDate(App.today);
		App.bindLabImport();

		App.dom.previousAssessmentDateButton.addEventListener('click', function () {
			App.shiftAssessmentDate(-1);
		});
		App.dom.nextAssessmentDateButton.addEventListener('click', function () {
			App.shiftAssessmentDate(1);
		});

		App.dom.todayAssessmentDateButton.addEventListener('click', function () {
			App.setAssessmentDate(App.today);
			App.renderLiveScore();
			App.applyLabValuesIfAvailable();
			App.dom.dateDropdown.open = false;
		});

		App.dom.datePickerInput.addEventListener('change', function () {
			App.setAssessmentDate(App.dom.datePickerInput.value);
			App.renderLiveScore();
			App.applyLabValuesIfAvailable();
			App.dom.dateDropdown.open = false;
		});

		App.fields.forEach(function (field) {
			document.getElementById(field).addEventListener('change', App.renderLiveScore);
		});

		document.getElementById('sofaForm').addEventListener('reset', function () {
			setTimeout(App.renderLiveScore);
		});

		document.getElementById('sofaForm').addEventListener('submit', function (event) {
			event.preventDefault();
			if (!App.ensurePatientId()) return;

			var currentScoreVal = App.score();
			var assessmentDate = App.getAssessmentDate();
			if (!assessmentDate) {
				App.dom.dateInput.setCustomValidity('Bitte ein gültiges Datum im Format DDMMYYYY eingeben.');
				App.dom.dateInput.reportValidity();
				App.dom.dateInput.setCustomValidity('');
				return;
			}

			var existing = App.state.records.findIndex(function (record) {
				return record.date === assessmentDate;
			});
			var record = { date: assessmentDate, score: currentScoreVal };

			if (existing >= 0) App.state.records[existing] = record;
			else App.state.records.push(record);

			App.state.records.sort(function (a, b) {
				return a.date.localeCompare(b.date);
			});
			App.saveLocally();
			App.renderLiveScore();
			App.renderHistory();

			if (App.state.records.length > 0) {
				var prevRecord = App.getPreviousRecord(record.date);
				var prevScore = prevRecord ? prevRecord.score : null;
				var delta = prevScore === null ? 0 : record.score - prevScore;
				var isInitialAlert = prevScore === null && record.score >= 2;
				var isWorsening = prevScore !== null && delta >= 2;

				if (isInitialAlert || isWorsening) {
					var modal = document.getElementById('alertModal');
					document.getElementById('modalMessage').textContent = isInitialAlert
						? 'Der erste SOFA-Score beträgt ' + record.score + ' Punkte und erreicht damit das Alarmkriterium.'
						: 'Der SOFA-Score ist um +' + delta + ' Punkte gegenüber dem vorherigen Wert angestiegen (Delta >= 2).';
					modal.showModal();
				}
			}
		});

		['infectionYes', 'infectionNo'].forEach(function (buttonId) {
			document.getElementById(buttonId).addEventListener('click', function () {
				document.getElementById('alertModal').close();
			});
		});

		document.getElementById('newPatient').addEventListener('click', function () {
			App.state.records = [];
			App.dom.patientInput.value = '';
			App.dom.wardInput.value = '';
			document.getElementById('sofaForm').reset();
			App.renderLiveScore();
			App.renderHistory();
			App.dom.patientInput.focus();
		});

		App.dom.patientInput.addEventListener('change', function () {
			var id = App.dom.patientInput.value.trim();
			if (id) {
				App.restoreLocalData(id);
				App.applyLabValuesIfAvailable();
				App.renderLiveScore();
				App.renderHistory();
			}
		});

		App.dom.patientInput.addEventListener('input', App.saveLocally);
		App.dom.wardInput.addEventListener('change', App.saveLocally);

		document.getElementById('exportHistory').addEventListener('click', function () {
			App.exportDelimited(';', 'csv');
		});
		document.getElementById('exportJson').addEventListener('click', function () {
			App.exportJson();
		});
		document.getElementById('importHistory').addEventListener('click', function () {
			document.getElementById('historyFile').click();
		});
		document.getElementById('historyFile').addEventListener('change', function (event) {
			var file = event.target.files[0];
			event.target.value = '';
			App.importHistoryFromFile(file);
		});

		App.restoreLocalData();
		App.renderLiveScore();
		App.renderHistory();
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', App.init);
	} else {
		App.init();
	}
})(window.SofaApp = window.SofaApp || {});
