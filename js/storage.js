(function (App) {
	'use strict';

	App.fileFormatVersion = 1;
	App.storagePrefix = 'sofa_patient_';
	App.defaultStorageKey = 'sofa_last_session';
	App.targetDirectoryHandle = null;

	App.getStorageKey = function () {
		var id = App.dom.patientInput.value.trim();
		return id
			? App.storagePrefix + id.replace(/[^a-z0-9_-]+/gi, '_')
			: App.defaultStorageKey;
	};

	App.sanitizeStorageName = function (value, fallback) {
		var normalized = value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
		return normalized.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || fallback;
	};

	App.saveLocally = function () {
		var key = App.getStorageKey();
		localStorage.setItem(key, JSON.stringify({
			patient: App.dom.patientInput.value.trim(),
			ward: App.dom.wardInput.value.trim(),
			records: App.state.records
		}));
		if (key !== App.defaultStorageKey) {
			localStorage.setItem(App.defaultStorageKey, JSON.stringify({
				lastPatientId: App.dom.patientInput.value.trim()
			}));
		}
	};

	App.restoreLocalData = function (targetId) {
		try {
			var key = App.defaultStorageKey;
			if (targetId) {
				key = App.storagePrefix + targetId.replace(/[^a-z0-9_-]+/gi, '_');
			} else {
				var lastSession = JSON.parse(localStorage.getItem(App.defaultStorageKey) || 'null');
				if (lastSession && lastSession.lastPatientId) {
					key = App.storagePrefix + lastSession.lastPatientId.replace(/[^a-z0-9_-]+/gi, '_');
				}
			}

			var data = JSON.parse(localStorage.getItem(key) || 'null');
			if (!data || !Array.isArray(data.records)) {
				App.state.records = [];
				return;
			}

			App.state.records = data.records.filter(function (record) {
				return /^\d{4}-\d{2}-\d{2}$/.test(record.date) &&
					Number.isInteger(record.score) &&
					record.score >= 0 &&
					record.score <= 24;
			}).sort(function (a, b) {
				return a.date.localeCompare(b.date);
			});

			App.dom.patientInput.value = data.patient || '';
			App.dom.wardInput.value = data.ward || '';
			if (App.state.records.length) {
				App.setAssessmentDate(App.state.records[App.state.records.length - 1].date);
			}
		} catch (error) {
			console.error('Fehler beim Laden lokaler Daten:', error);
		}
	};

	App.downloadFile = async function (content, type, filename, folderName) {
		if ('showDirectoryPicker' in window) {
			try {
				if (!App.targetDirectoryHandle) {
					App.targetDirectoryHandle = await window.showDirectoryPicker({
						id: 'sofa_scores_folder',
						startIn: 'documents'
					});
				}

				var sofaScoresDirectoryHandle = await App.targetDirectoryHandle.getDirectoryHandle('Sofa Scores', { create: true });
				var stationDirectoryHandle = await sofaScoresDirectoryHandle.getDirectoryHandle(folderName, { create: true });
				var fileHandle = await stationDirectoryHandle.getFileHandle(filename, { create: true });
				var writable = await fileHandle.createWritable();
				await writable.write(content);
				await writable.close();
				return;
			} catch (err) {
				if (err.name === 'AbortError') return;
				console.warn('Ordnerzugriff nicht möglich, wechsle zu Standard-Download:', err);
			}
		}

		var blob = new Blob([content], { type: type });
		var url = URL.createObjectURL(blob);
		var link = document.createElement('a');
		link.href = url;
		link.download = folderName ? folderName + '-' + filename : filename;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
	};

	App.exportDelimited = async function (separator, extension) {
		if (!App.ensurePatientId()) return;
		if (!App.ensureWard()) return;
		if (!App.ensureRecords()) return;

		var lines = [
			['Patient / Fall-ID', App.dom.patientInput.value.trim()],
			['Station', App.dom.wardInput.value.trim()],
			[],
			['Datum', 'SOFA gesamt', 'Delta zum Erstwert']
		];
		App.state.records.forEach(function (record, index) {
			var previousRecord = index ? App.state.records[index - 1] : null;
			var delta = previousRecord ? record.score - previousRecord.score : 0;
			lines.push([record.date, record.score, delta]);
		});
		var content = '\uFEFF' + lines.map(function (line) {
			return line.map(function (value) {
				return String(value).replaceAll('"', '""');
			}).map(function (value) {
				return '"' + value + '"';
			}).join(separator);
		}).join('\r\n');
		var stationFolder = App.sanitizeStorageName(App.dom.wardInput.value, 'Ohne-Station');
		await App.downloadFile(
			content,
			extension === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8',
			'sofa-verlauf-' + App.dom.patientInput.value.trim().replace(/[^a-z0-9_-]+/gi, '_') + '.' + extension,
			stationFolder
		);
	};

	App.exportJson = async function () {
		if (!App.ensurePatientId()) return;
		if (!App.ensureWard()) return;
		if (!App.ensureRecords()) return;

		var data = {
			format: 'SOFA Monitor Verlauf',
			version: App.fileFormatVersion,
			exportedAt: new Date().toISOString(),
			patient: App.dom.patientInput.value.trim(),
			ward: App.dom.wardInput.value.trim(),
			records: App.state.records
		};
		var stationFolder = App.sanitizeStorageName(App.dom.wardInput.value, 'Ohne-Station');
		await App.downloadFile(
			JSON.stringify(data, null, 2),
			'application/json;charset=utf-8',
			'sofa-verlauf-' + App.dom.patientInput.value.trim().replace(/[^a-z0-9_-]+/gi, '_') + '.json',
			stationFolder
		);
	};

	App.importHistoryFromFile = function (file) {
		if (!file) return;
		var reader = new FileReader();
		reader.onload = function () {
			try {
				var data = JSON.parse(reader.result);
				if (
					data.format !== 'SOFA Monitor Verlauf' ||
					!Array.isArray(data.records) ||
					data.records.some(function (record) {
						return !/^\d{4}-\d{2}-\d{2}$/.test(record.date) ||
							!Number.isInteger(record.score) ||
							record.score < 0 ||
							record.score > 24;
					})
				) {
					throw new Error('Ungültiges Format');
				}
				App.state.records = data.records.map(function (record) {
					return { date: record.date, score: record.score };
				}).sort(function (a, b) {
					return a.date.localeCompare(b.date);
				});
				App.dom.patientInput.value = data.patient || '';
				App.dom.wardInput.value = data.ward || '';
				App.setAssessmentDate(
					App.state.records.length
						? App.state.records[App.state.records.length - 1].date
						: App.today
				);
				App.saveLocally();
				App.renderLiveScore();
				App.renderHistory();
			} catch (error) {
				alert('Die Datei konnte nicht als SOFA-Verlauf geladen werden.');
			}
		};
		reader.readAsText(file);
	};
})(window.SofaApp = window.SofaApp || {});
