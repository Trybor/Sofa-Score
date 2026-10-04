(function (App) {
	'use strict';

	App.renderChartBlock = function (records) {
		var width = 800;
		var height = 200;
		var padding = { top: 15, right: 25, bottom: 25, left: 32 };
		var innerWidth = width - padding.left - padding.right;
		var innerHeight = height - padding.top - padding.bottom;

		var maxScore = Math.max.apply(null, records.map(function (r) { return r.score; }).concat([8]));
		var yMax = Math.min(24, Math.ceil((maxScore + 2) / 2) * 2);

		function getY(val) {
			return padding.top + innerHeight - (val / yMax) * innerHeight;
		}

		function getX(idx) {
			if (records.length === 1) return padding.left + innerWidth / 2;
			return padding.left + (idx / (records.length - 1)) * innerWidth;
		}

		var gridHtml = '';
		for (var i = 0; i <= 4; i++) {
			var val = Math.round((yMax / 4) * i);
			var y = getY(val);
			gridHtml +=
				'<line stroke="#d5dce3" stroke-width="1" stroke-dasharray="3 3" x1="' + padding.left +
				'" y1="' + y + '" x2="' + (width - padding.right) + '" y2="' + y + '" />' +
				'<text fill="#607080" font-size="11" x="' + (padding.left - 8) + '" y="' + (y + 4) +
				'" text-anchor="end">' + val + '</text>';
		}

		var points = records.map(function (r, idx) {
			return { x: getX(idx), y: getY(r.score), record: r };
		});
		var polylineCoords = points.map(function (p) {
			return p.x + ',' + p.y;
		}).join(' ');

		var pointsHtml = '';
		points.forEach(function (p, idx) {
			var delta = idx > 0 ? p.record.score - records[idx - 1].score : 0;
			var strokeColor = 'var(--green)';
			if (p.record.score >= 2 || delta >= 2) strokeColor = 'var(--red)';
			else if (p.record.score === 1 || delta === 1) strokeColor = 'var(--yellow)';

			var dateStr = new Date(p.record.date + 'T12:00:00').toLocaleDateString('de-DE', {
				day: '2-digit',
				month: '2-digit'
			});

			pointsHtml +=
				'<circle cx="' + p.x + '" cy="' + p.y + '" r="4.5" fill="#fff" stroke="' + strokeColor +
				'" stroke-width="2.5">' +
				'<title>' + p.record.date + ': SOFA ' + p.record.score + ' (Delta: ' +
				(delta > 0 ? '+' : '') + delta + ')</title>' +
				'</circle>' +
				'<text fill="#607080" font-size="11" x="' + p.x + '" y="' + (height - 10) +
				'" text-anchor="middle">' + dateStr + '</text>';
		});

		return (
			'<div class="chart-box">' +
			'<div style="font-size: 11px; font-weight: 800; color: var(--muted); text-transform: uppercase; margin-bottom: 6px;">Verlaufskurve</div>' +
			'<svg viewBox="0 0 ' + width + ' ' + height + '">' +
			gridHtml +
			'<polyline fill="none" stroke="var(--teal)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="' +
			polylineCoords + '" />' +
			pointsHtml +
			'</svg>' +
			'</div>'
		);
	};
})(window.SofaApp = window.SofaApp || {});
