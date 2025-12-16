let globalData = [];
let rawCsvData = [];
let polygonSeries;
let myLineChart = null;
let myPieChart = null;
let myScatterChart = null;
let myRadarChart = null;
let myBarChart = null;
let currentSelectedRegionName = null;

Promise.all([
    fetch('ph_regions.geojson').then(res => res.json()),
    new Promise((resolve) => {
        Papa.parse("ebf_data.csv", {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data)
        });
    })
]).then(([geoData, csvData]) => {
    rawCsvData = csvData;
    globalData = processData(csvData);
    globalData.sort((a, b) => a.Region.localeCompare(b.Region));

    setTimeout(() => {
        initDashboard(geoData, globalData);

        const loader = document.getElementById('loader-wrapper');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.display = 'none';
            }, 500);
        }
    }, 4000);
}).catch(err => console.error("Error loading files:", err));

function processData(rawCsv) {
    let regionMap = {};

    const createYearObj = (year) => ({
        year: year,
        totalEBF: 0,
        count: 0,
        urbanSum: 0,
        urbanCount: 0,
        ruralSum: 0,
        ruralCount: 0,
        maleSum: 0,
        maleCount: 0,
        femaleSum: 0,
        femaleCount: 0,
        wealthCounts: {
            "Poorest": 0,
            "Poorer": 0,
            "Middle": 0,
            "Richer": 0,
            "Richest": 0
        },
        ageBuckets: {
            0: [],
            1: [],
            2: [],
            3: [],
            4: [],
            5: []
        }
    });

    rawCsv.forEach(row => {
        let rName = row.Region;
        if (!rName) return;

        if (!regionMap[rName]) {
            regionMap[rName] = {
                Region: rName,
                historyObj: {}
            };
        }

        let year = parseInt(row.Year);
        if (!regionMap[rName].historyObj[year]) {
            regionMap[rName].historyObj[year] = createYearObj(year);
        }

        let yObj = regionMap[rName].historyObj[year];
        let val = parseFloat(row.EBF_Rate);

        yObj.totalEBF += val;
        yObj.count++;

        if (row.Type === "Urban") {
            yObj.urbanSum += val;
            yObj.urbanCount++;
        }
        if (row.Type === "Rural") {
            yObj.ruralSum += val;
            yObj.ruralCount++;
        }
        if (row.Child_Sex === "Male") {
            yObj.maleSum += val;
            yObj.maleCount++;
        }
        if (row.Child_Sex === "Female") {
            yObj.femaleSum += val;
            yObj.femaleCount++;
        }

        if (yObj.wealthCounts.hasOwnProperty(row.Wealth_Index)) {
            yObj.wealthCounts[row.Wealth_Index]++;
        }

        let age = parseInt(row.Age_Month);
        if (yObj.ageBuckets[age] !== undefined) {
            yObj.ageBuckets[age].push(val);
        }
    });

    return Object.values(regionMap).map(r => {
        let historyArray = Object.values(r.historyObj).map(h => {
            const avg = (sum, count) => count > 0 ? parseFloat((sum / count).toFixed(1)) : 0;

            let ageavgs = {};
            for (let i = 0; i <= 5; i++) {
                let buckets = h.ageBuckets[i];
                let sum = buckets.reduce((a, b) => a + b, 0);
                ageavgs[i] = buckets.length ? parseFloat((sum / buckets.length).toFixed(1)) : 0;
            }

            return {
                year: h.year,
                value: avg(h.totalEBF, h.count),
                urbanAvg: avg(h.urbanSum, h.urbanCount),
                ruralAvg: avg(h.ruralSum, h.ruralCount),
                maleAvg: avg(h.maleSum, h.maleCount),
                femaleAvg: avg(h.femaleSum, h.femaleCount),
                wealthDist: h.wealthCounts,
                ageTrend: ageavgs
            };
        });

        historyArray.sort((a, b) => a.year - b.year);
        let latest = historyArray[historyArray.length - 1];

        return {
            Region: r.Region,
            history: historyArray,
            value: latest ? latest.value : 0
        };
    });
}

function initDashboard(geoJSON, data) {
    let allYears = new Set();
    data.forEach(d => d.history.forEach(h => allYears.add(h.year)));
    let sortedYears = Array.from(allYears).sort((a, b) => b - a);
    let latestYear = sortedYears[0];

    setupFilters(sortedYears);

    let nationalObj = calculateNationalAggregate(data);

    createMap(geoJSON, data);

    createLineChart(nationalObj.history);
    createPieChart();

    createRadarChart(nationalObj, nationalObj);
    createScatterChart(data, latestYear);

    renderLeaderboard(data, latestYear);
    renderHeatmap(data);

    calculateNationalKPIs(nationalObj, latestYear);
    updateCharts(nationalObj);
    resetSelectedRegionKPI();

    setupAllModals();
    setupDarkMode();
    setupChartInfoModals();
    setupModalTouchClose();

    document.getElementById('pie-chart-header').innerText = "💰 Wealth Index Distribution";
}

function resetSelectedRegionKPI() {
    let kpiVal = document.getElementById('kpi-region-val');
    if (kpiVal) kpiVal.innerText = "--%";

    let kpiName = document.getElementById('kpi-region-name');
    if (kpiName) kpiName.innerText = "Select a Region";

    let arrowEl = document.getElementById('kpi-region-trend');
    if (arrowEl) {
        arrowEl.innerHTML = ""; 
        arrowEl.style.display = "none"; 
    }
}

function setupFilters(years) {
    let yearFilter = document.getElementById('yearFilter');
    if (!yearFilter) return;

    yearFilter.innerHTML = '';
    years.forEach(y => {
        let opt = document.createElement('option');
        opt.value = y;
        opt.innerText = y;
        yearFilter.appendChild(opt);
    });

    yearFilter.addEventListener('change', function() {
        let selectedYear = parseInt(this.value);

        globalData.forEach(r => {
            let yearData = r.history.find(h => h.year === selectedYear);
            r.value = yearData ? yearData.value : 0;
        });
        updateMapVisuals(true);

        let nationalObj = calculateNationalAggregate(globalData);
        calculateNationalKPIs(nationalObj, selectedYear);

        if (currentSelectedRegionName) {
            let regionData = globalData.find(r => r.Region === currentSelectedRegionName);
            if (regionData) {
                updateSidebar(regionData);
                updateCharts(regionData);
            }
        } else {

            updateCharts(nationalObj);
            resetSelectedRegionKPI();
        }
    });
}

function calculateNationalAggregate(regions) {
    let allYears = new Set();
    regions.forEach(r => r.history.forEach(h => allYears.add(h.year)));
    let sortedYears = Array.from(allYears).sort((a, b) => a - b);

    let history = sortedYears.map(year => {
        let sumVal = 0,
            count = 0;
        let sumUrban = 0,
            countUrban = 0;
        let sumRural = 0,
            countRural = 0;
        let sumMale = 0,
            countMale = 0;
        let sumFemale = 0,
            countFemale = 0;
        let wealthAgg = {
            "Poorest": 0,
            "Poorer": 0,
            "Middle": 0,
            "Richer": 0,
            "Richest": 0
        };
        let ageAgg = {
            0: [],
            1: [],
            2: [],
            3: [],
            4: [],
            5: []
        };

        regions.forEach(r => {
            let h = r.history.find(x => x.year === year);
            if (h) {
                sumVal += h.value;
                count++;
                sumUrban += h.urbanAvg;
                countUrban++;
                sumRural += h.ruralAvg;
                countRural++;
                sumMale += h.maleAvg;
                countMale++;
                sumFemale += h.femaleAvg;
                countFemale++;
                Object.keys(wealthAgg).forEach(k => wealthAgg[k] += (h.wealthDist[k] || 0));
                Object.keys(ageAgg).forEach(k => ageAgg[k].push(h.ageTrend[k]));
            }
        });

        let finalAgeTrend = {};
        Object.keys(ageAgg).forEach(k => {
            let vals = ageAgg[k];
            let s = vals.reduce((a, b) => a + b, 0);
            finalAgeTrend[k] = vals.length ? parseFloat((s / vals.length).toFixed(1)) : 0;
        });

        return {
            year: year,
            value: count ? parseFloat((sumVal / count).toFixed(1)) : 0,
            urbanAvg: countUrban ? parseFloat((sumUrban / countUrban).toFixed(1)) : 0,
            ruralAvg: countRural ? parseFloat((sumRural / countRural).toFixed(1)) : 0,
            maleAvg: countMale ? parseFloat((sumMale / countMale).toFixed(1)) : 0,
            femaleAvg: countFemale ? parseFloat((sumFemale / countFemale).toFixed(1)) : 0,
            wealthDist: wealthAgg,
            ageTrend: finalAgeTrend
        };
    });

    return {
        Region: "National Average",
        displayName: "National Avg",
        history: history,
        value: history[history.length - 1].value
    };
}

function createLineChart(nationalHistoryData) {
    const ctx = document.getElementById('lineChartCanvas').getContext('2d');
    if (myLineChart) myLineChart.destroy();

    const labels = nationalHistoryData.map(d => d.year);
    const dataValues = nationalHistoryData.map(d => d.value);
    const targetData = new Array(labels.length).fill(70);

    myLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                    label: 'National Avg',
                    data: dataValues,
                    borderColor: '#4cc9f0',
                    backgroundColor: '#4cc9f0',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.3,
                    pointRadius: 4
                },
                {
                    label: 'Target (70%)',
                    data: targetData,
                    borderColor: '#c0392b',
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false,
                    borderDash: [2, 2]
                },
                {
                    label: 'Region Rate',
                    data: [],
                    borderColor: '#2c3e50',
                    backgroundColor: '#2c3e50',
                    borderWidth: 3,
                    tension: 0.3,
                    pointRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: '#dde1e7'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        usePointStyle: true
                    }
                }
            }
        }
    });
}

function createPieChart() {
    const ctx = document.getElementById('pieChartCanvas').getContext('2d');
    if (myPieChart) myPieChart.destroy();

    myPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Poorest', 'Poorer', 'Middle', 'Richer', 'Richest'],
            datasets: [{
                data: [20, 20, 20, 20, 20],
                backgroundColor: ['#e74c3c', '#e67e22', '#f1c40f', '#3498db', '#2ecc71'],
                borderWidth: 1,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 10,
                        font: {
                            size: 10
                        }
                    }
                }
            }
        }
    });
}

function updatePieChart(historyItem) {
    if (!historyItem || !myPieChart) return;
    fadePieChart();

    let w = historyItem.wealthDist;
    let dataArr = [w.Poorest, w.Poorer, w.Middle, w.Richer, w.Richest];
    myPieChart.data.datasets[0].data = dataArr;
    myPieChart.update();
}

function createScatterChart(data, year) {
    const ctx = document.getElementById('scatterChartCanvas').getContext('2d');
    if (myScatterChart) myScatterChart.destroy();

    myScatterChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['0m', '1m', '2m', '3m', '4m', '5m'],
            datasets: [{
                label: 'EBF Adherence by Age',
                data: [],
                borderColor: '#4361ee',
                backgroundColor: 'rgba(67, 97, 238, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'EBF %'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Infant Age (Months)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function createRadarChart(regionData, nationalData) {
    const ctx = document.getElementById('radarChartCanvas').getContext('2d');
    if (myRadarChart) myRadarChart.destroy();

    myRadarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Urban', 'Rural', 'Male', 'Female'],
            datasets: [{
                    label: 'Region',
                    data: [0, 0, 0, 0],
                    backgroundColor: '#f72585',
                    borderRadius: 4
                },
                {
                    label: 'National',
                    data: [0, 0, 0, 0],
                    backgroundColor: '#2c3e50',
                    borderRadius: 4,
                    hidden: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            },
            plugins: {
                legend: {
                    display: true
                }
            }
        }
    });
}

function renderLeaderboard(data, year) {
    const ctx = document.getElementById('barChartCanvas');
    if (!ctx) return;

    let rankData = data.map(r => {
            let h = r.history.find(i => i.year === year);
            return {
                Region: r.Region,
                value: h ? h.value : 0
            };
        })
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);

    const labels = rankData.map(d => d.Region);
    const values = rankData.map(d => d.value);
    const colors = values.map(v => v >= 50 ? '#27ae60' : (v >= 30 ? '#f39c12' : '#c0392b'));

    if (myBarChart) myBarChart.destroy();

    myBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'EBF Rate (%)',
                data: values,
                backgroundColor: colors,
                borderWidth: 0,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: '#dde1e7'
                    }
                },
                y: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });

    const yearEl = document.getElementById('leaderboard-year');
    if (yearEl) yearEl.innerText = year;
}

function renderHeatmap(data) {
    const table = document.getElementById('heatmapTable');
    if (!table) return;

    table.innerHTML = '';

    let allYears = new Set();
    data.forEach(r => r.history.forEach(h => allYears.add(h.year)));
    const years = Array.from(allYears).sort((a, b) => a - b);

    let thead = `<tr><th>Region</th>${years.map(y => `<th>${y}</th>`).join('')}</tr>`;
    table.innerHTML += thead;

    data.forEach(r => {
        let rowHtml = `<tr><td>${r.Region}</td>`;
        years.forEach(y => {
            let h = r.history.find(item => item.year === y);
            let val = h ? h.value : null;
            let cellClass = 'heat-null';
            let displayVal = '--';

            if (val !== null) {
                displayVal = val + '%';
                if (val >= 50) cellClass = 'heat-high';
                else if (val >= 30) cellClass = 'heat-med';
                else cellClass = 'heat-low';
            }
            rowHtml += `<td class="heat-cell ${cellClass}">${displayVal}</td>`;
        });
        rowHtml += `</tr>`;
        table.innerHTML += rowHtml;
    });
}

function updateCharts(dataObj) {
    if (!dataObj) return;

    let selectedYear = parseInt(document.getElementById('yearFilter').value);
    let hist = dataObj.history.find(h => h.year === selectedYear);

    let pieHeader = document.getElementById("pie-chart-header");
    if (pieHeader) pieHeader.innerText = `💰 Wealth Distribution (${dataObj.Region || dataObj.displayName})`;

    let lineHeader = document.getElementById("line-chart-header");
    if (lineHeader) lineHeader.innerHTML = `📈 Historical Trend`;

    if (myLineChart) {
        const chartLabels = myLineChart.data.labels;
        const newData = chartLabels.map(year => {
            const h = dataObj.history.find(item => item.year === year);
            return h ? h.value : null;
        });
        myLineChart.data.datasets[2].data = newData;
        myLineChart.data.datasets[2].label = dataObj.Region || dataObj.displayName;
        myLineChart.update();
    }

    if (hist) updatePieChart(hist);

    if (hist && myRadarChart) {
        let nObj = calculateNationalAggregate(globalData);
        let nHist = nObj.history.find(h => h.year === selectedYear);

        let rData = [hist.urbanAvg, hist.ruralAvg, hist.maleAvg, hist.femaleAvg];
        let nData = nHist ? [nHist.urbanAvg, nHist.ruralAvg, nHist.maleAvg, nHist.femaleAvg] : [0, 0, 0, 0];

        myRadarChart.data.datasets[0].data = rData;
        myRadarChart.data.datasets[0].label = dataObj.Region || "Selected";
        myRadarChart.data.datasets[1].data = nData;
        myRadarChart.update();
    }

    if (hist && myScatterChart) {
        let ageData = [
            hist.ageTrend[0], hist.ageTrend[1], hist.ageTrend[2],
            hist.ageTrend[3], hist.ageTrend[4], hist.ageTrend[5]
        ];
        myScatterChart.data.datasets[0].data = ageData;
        myScatterChart.data.datasets[0].label = `${dataObj.Region || 'National'} (Age Trend)`;
        myScatterChart.update();
    }

    renderLeaderboard(globalData, selectedYear);
    updateSidebar(dataObj);
    const isDark = document.body.classList.contains('dark-mode');
    updateChartColors(isDark);
}

function calculateNationalKPIs(natObj, selectedYear) {
    let hist = natObj.history.find(h => h.year === selectedYear);
    let trendEl = document.getElementById('kpi-national-trend');
    
    if (!hist) {
        setTextWithFade('kpi-national', "--%");
        return;
    }
    
    let currentAvg = hist.value;
    setTextWithFade('kpi-national', currentAvg.toFixed(1) + "%");

    if (trendEl) {
        let target = 70;
        let diff = (currentAvg - target).toFixed(1);

        trendEl.style.display = "inline-flex";
        trendEl.style.alignItems = "center";
        trendEl.style.gap = "4px";

        const iconTrendUp = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;
        const iconTrendDown = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--vibrant-red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>`;

        if (diff >= 0) {
            trendEl.style.color = "#27ae60";
            trendEl.innerHTML = `${iconTrendUp} +${diff}%`;
        } else {
            trendEl.style.color = "var(--vibrant-red)";
            trendEl.innerHTML = `${iconTrendDown} ${diff}% away`;
        }

        trendEl.classList.remove("fade-in");
        void trendEl.offsetWidth;
        trendEl.classList.add("fade-in");
    }
}

function createMap(geoJSON, data) {
    const nameMapping = {
        "National Capital Region": "NCR",
        "Metropolitan Manila": "NCR",
        "NCR": "NCR",
        "Cordillera Administrative Region": "CAR",
        "CAR": "CAR",
        "Ilocos Region": "Region I",
        "Region I": "Region I",
        "Cagayan Valley": "Region II",
        "Region II": "Region II",
        "Central Luzon": "Region III",
        "Region III": "Region III",
        "CALABARZON": "Region IV-A",
        "Region IV-A": "Region IV-A",
        "MIMAROPA": "MIMAROPA",
        "Mimaropa": "MIMAROPA",
        "Region IV-B": "MIMAROPA",
        "Bicol Region": "Region V",
        "Region V": "Region V",
        "Western Visayas": "Region VI",
        "Region VI": "Region VI",
        "Central Visayas": "Region VII",
        "Region VII": "Region VII",
        "Negros Island Region": "Region VII",
        "Eastern Visayas": "Region VIII",
        "Region VIII": "Region VIII",
        "Zamboanga Peninsula": "Region IX",
        "Region IX": "Region IX",
        "Northern Mindanao": "Region X",
        "Region X": "Region X",
        "Davao Region": "Region XI",
        "Region XI": "Region XI",
        "SOCCSKSARGEN": "Region XII",
        "Soccsksargen": "Region XII",
        "Region XII": "Region XII",
        "Caraga": "Caraga",
        "Region XIII": "Caraga",
        "Autonomous Region in Muslim Mindanao": "BARMM",
        "Bangsamoro Autonomous Region in Muslim Mindanao": "BARMM",
        "BARMM": "BARMM"
    };

    geoJSON.features.forEach(feature => {
        let p = feature.properties;
        let mapName = p.ADM1_EN || p.REGION || p.name || p.NAME_1;
        if (mapName) mapName = mapName.trim();

        let csvName = nameMapping[mapName] || mapName;
        const match = data.find(r => r.Region === csvName);

        if (match) {
            feature.properties.dataContext = match;
            feature.properties.value = match.value;
            feature.properties.displayName = csvName;
        } else {
            feature.properties.value = 0;
            feature.properties.displayName = mapName;
        }
    });

    var root = am5.Root.new("chartdiv");
    root.setThemes([am5themes_Animated.new(root)]);

    var chart = root.container.children.push(am5map.MapChart.new(root, {
        panX: "none",
        panY: "none",
        wheelY: "none",
        projection: am5map.geoMercator()
    }));

    polygonSeries = chart.series.push(am5map.MapPolygonSeries.new(root, {
        geoJSON: geoJSON,
        valueField: "value"
    }));

    polygonSeries.mapPolygons.template.setAll({
        tooltipText: "{displayName}: {value}%",
        stroke: am5.color("#d1d8e0"),
        strokeWidth: 1.5,
        interactive: true,
        fill: am5.color("#d1d8e0")
    });

    var hoverState = polygonSeries.mapPolygons.template.states.create("hover", {
        stroke: am5.color("#000000"),
        strokeWidth: 3,
        zIndex: 99
    });

    polygonSeries.mapPolygons.template.events.on("click", function(ev) {
        var geoProps = ev.target.dataItem.dataContext;
        var customData = geoProps.dataContext;
        if (customData) {
            currentSelectedRegionName = customData.Region;
            customData.displayName = geoProps.displayName;
            updateSidebar(customData);
            updateCharts(customData);
        }
    });

    polygonSeries.events.on("datavalidated", function() {
        updateMapVisuals(false);
    });

    chart.appear(1000, 100);
}

function updateMapVisuals(shouldAnimate = true) {
    if (polygonSeries) {
        polygonSeries.mapPolygons.each(function(polygon) {
            let geoJSONProps = polygon.dataItem.dataContext;
            if (geoJSONProps && geoJSONProps.dataContext) {
                let customData = geoJSONProps.dataContext;
                polygon.dataItem.set("value", customData.value);
                polygon.set("tooltipText", `{displayName}: ${customData.value}%`);
                let val = customData.value;
                let newColor;
                if (val === undefined || val === null || val === 0) newColor = am5.color("#d1d8e0");
                else if (val >= 50) newColor = am5.color("#27ae60");
                else if (val >= 30) newColor = am5.color("#f39c12");
                else newColor = am5.color("#c0392b");

                if (shouldAnimate) {
                    polygon.animate({
                        key: "fill",
                        to: newColor,
                        duration: 800,
                        easing: am5.ease.out(am5.ease.cubic)
                    });
                } else {
                    polygon.set("fill", newColor);
                }
            }
        });
    }
}

function updateSidebar(data) {
    if (!data) return;
    let finalName = data.displayName || data.Region;
    if (finalName && !data.displayName && finalName.startsWith("Region") && !finalName.includes(" ")) {
        finalName = finalName.replace("Region", "Region ");
    }
    setTextWithFade('region-name', finalName);
    setTextWithFade('region-rate', data.value + "%");
    setTextWithFade('kpi-region-val', data.value + "%");
    setTextWithFade('kpi-region-name', finalName);
    let kpiVal = document.getElementById('kpi-region-val');
    let kpiName = document.getElementById('kpi-region-name');
    if (kpiVal) kpiVal.innerText = data.value + "%";
    if (kpiName) kpiName.innerText = finalName;
    let arrowEl = document.getElementById('kpi-region-trend');
    if (arrowEl) {

        if (data.Region === "National Average" && !currentSelectedRegionName) {
             arrowEl.style.display = "none"; 
        } else {
             arrowEl.style.display = "inline-flex";
             let target = 70;
             let gap = (target - data.value).toFixed(1);
             if (gap > 0) arrowEl.innerHTML = `<span style="color:var(--vibrant-red); font-size: 0.7rem;">✘ ${gap}% away</span>`;
             else arrowEl.innerHTML = `<span style="color:#27ae60; font-size: 0.7rem;">✓ Target Met!</span>`;
        }
    }
    let infoCard = document.querySelector('.info-card');
    let valueEl = document.getElementById('region-rate');
    if (infoCard && valueEl) {
        if (data.value >= 50) {
            infoCard.style.borderLeftColor = "#27ae60";
            valueEl.style.color = "#27ae60";
        } else if (data.value >= 30) {
            infoCard.style.borderLeftColor = "#f39c12";
            valueEl.style.color = "#f39c12";
        } else {
            infoCard.style.borderLeftColor = "#c0392b";
            valueEl.style.color = "#c0392b";
        }
    }
}

function setTextWithFade(elementId, text) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.classList.remove("fade-in");
    void el.offsetWidth;
    el.innerText = text;
    el.classList.add("fade-in");
}

function fadePieChart() {
    const el = document.getElementById("piechartdiv");
    if (!el) return;
    el.classList.remove("fade-in");
    void el.offsetWidth;
    el.classList.add("fade-in");
}

function updateChartColors(isDark) {
    let axisTextColor = isDark ? "#ffffff" : "#2b2d42";
    let gridColor = isDark ? "rgba(255, 255, 255, 0.2)" : "#dde1e7";

    let regionLineColorDark = "#e0e0e0";
    let regionLineColorLight = "#2c3e50";

    let natBarColorDark = "#e0e0e0";
    let natBarColorLight = "#2c3e50";

    let regionBarColor = "#f72585";

    let mapStrokeNormal = isDark ? am5.color("#000000") : am5.color("#ffffff"); 
    let mapStrokeHover  = isDark ? am5.color("#ffffff") : am5.color("#2c3e50");

    const updateCommon = (chart) => {
        if (!chart) return;
        if (chart.options.scales.x) {
            chart.options.scales.x.ticks.color = axisTextColor;
            if (chart.options.scales.x.title) chart.options.scales.x.title.color = axisTextColor;
            if (chart.options.scales.x.grid) chart.options.scales.x.grid.color = gridColor;
        }
        if (chart.options.scales.y) {
            chart.options.scales.y.ticks.color = axisTextColor;
            if (chart.options.scales.y.title) chart.options.scales.y.title.color = axisTextColor;
            if (chart.options.scales.y.grid) chart.options.scales.y.grid.color = gridColor;
        }
        if (chart.options.plugins.legend) {
            chart.options.plugins.legend.labels.color = axisTextColor;
        }
        chart.update();
    };

    updateCommon(myLineChart);
    updateCommon(myScatterChart);
    updateCommon(myRadarChart);
    updateCommon(myBarChart);

    if (myLineChart) {
        const regionDataset = myLineChart.data.datasets[2];
        if (regionDataset) {
            regionDataset.borderColor = isDark ? regionLineColorDark : regionLineColorLight;
            regionDataset.backgroundColor = isDark ? regionLineColorDark : regionLineColorLight;
        }
        myLineChart.update();
    }

    if (myRadarChart) {
        const regionDataset = myRadarChart.data.datasets[0];
        const natDataset = myRadarChart.data.datasets[1];

        if (regionDataset) {
            regionDataset.backgroundColor = regionBarColor;
        }

        if (natDataset) {
            natDataset.backgroundColor = isDark ? natBarColorDark : natBarColorLight;
        }
        myRadarChart.update();
    }

    if (myPieChart) {
        myPieChart.options.plugins.legend.labels.color = axisTextColor;
        myPieChart.data.datasets[0].borderColor = isDark ? '#16213e' : '#ffffff';
        myPieChart.update();

    if(polygonSeries) {
        polygonSeries.mapPolygons.template.set("stroke", mapStrokeNormal);
        let templateHover = polygonSeries.mapPolygons.template.states.lookup("hover");
            if (templateHover) templateHover.set("stroke", mapStrokeHover);

                polygonSeries.mapPolygons.each(function(polygon) {
                polygon.set("stroke", mapStrokeNormal);
                let defaultState = polygon.states.lookup("default");
                    if (!defaultState) defaultState = polygon.states.create("default", { stroke: mapStrokeNormal });
                    else defaultState.set("stroke", mapStrokeNormal);

                    let hoverState = polygon.states.lookup("hover");
                    if (hoverState) hoverState.set("stroke", mapStrokeHover);
                    else polygon.states.create("hover", { stroke: mapStrokeHover });
            });
        }
    }
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.add("hiding");
    setTimeout(() => {
        modal.style.display = "none";
        modal.classList.remove("hiding");
    }, 300);
}

function setupAllModals() {
    const infoModal = document.getElementById("infoModal");
    const leaderModal = document.getElementById("leaderboardModal");
    const heatmapModal = document.getElementById("heatmapModal");
    const infoBtn = document.getElementById("infoBtn");
    const leaderBtn = document.getElementById("leaderboardBtn");
    const heatmapBtn = document.getElementById("heatmapBtn");
    const closeInfo = document.querySelector(".close-modal");
    const closeLeader = document.querySelector(".close-leaderboard");
    const closeHeatmap = document.querySelector(".close-heatmap");
    const isOpen = (modal) => modal && modal.style.display === "block";
    const closeAllOthers = (currentModal) => {
        [infoModal, leaderModal, heatmapModal].forEach(modal => {
            if (modal !== currentModal && isOpen(modal)) closeModal(modal);
        });
    };
    if (infoBtn && infoModal) infoBtn.onclick = () => {
        closeAllOthers(infoModal);
        isOpen(infoModal) ? closeModal(infoModal) : infoModal.style.display = "block";
    };
    if (leaderBtn && leaderModal) leaderBtn.onclick = () => {
        closeAllOthers(leaderModal);
        isOpen(leaderModal) ? closeModal(leaderModal) : leaderModal.style.display = "block";
    };
    if (heatmapBtn && heatmapModal) heatmapBtn.onclick = () => {
        closeAllOthers(heatmapModal);
        isOpen(heatmapModal) ? closeModal(heatmapModal) : heatmapModal.style.display = "block";
    };
    if (closeInfo) closeInfo.onclick = () => closeModal(infoModal);
    if (closeLeader) closeLeader.onclick = () => closeModal(leaderModal);
    if (closeHeatmap) closeHeatmap.onclick = () => closeModal(heatmapModal);
}

function setupModalTouchClose() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', function(event) {
            if (event.target === this) closeModal(modal);
        });
    });
}

function setupDarkMode() {
    const toggleDesktop = document.getElementById('darkModeToggle');
    const toggleMobile = document.getElementById('darkModeToggleMobile');

    function handleModeChange(isChecked) {
        if (toggleDesktop) toggleDesktop.checked = isChecked;
        if (toggleMobile) toggleMobile.checked = isChecked;
        if (isChecked) {
            document.body.classList.add('dark-mode');
            updateChartColors(true);
        } else {
            document.body.classList.remove('dark-mode');
            updateChartColors(false);
        }
    }
    if (toggleDesktop) toggleDesktop.addEventListener('change', (e) => handleModeChange(e.target.checked));
    if (toggleMobile) toggleMobile.addEventListener('change', (e) => handleModeChange(e.target.checked));
}

const chartInfoData = {
    line: {
        title: "📈 Historical Trend",
        content: `
            <div class="explanation-section">
                <h4>What does this show?</h4>
                <p>This tracks the Exclusive Breastfeeding (EBF) rate across all available survey years (e.g., 2017, 2022).</p>
            </div>
            <div class="explanation-section">
                <h4>How to read it?</h4>
                <p><strong>Dashed Cyan Line:</strong> The National Average.</p>
                <p><strong>Solid Line:</strong> The Region you selected.</p>
                <p><strong>Red Dashed Line:</strong> The 70% Target.</p>
            </div>
            <div class="explanation-section">
                <h4>What is good?</h4>
                <p>An upward trend that crosses above the red 70% target line is ideal.</p>
            </div>
        `
    },
    radar: {
        title: "⚡ Demographic Profile",
        content: `
            <div class="explanation-section">
                <h4>What does this show?</h4>
                <p>A comparison of EBF adherence across different demographic groups.</p>
            </div>
            <div class="explanation-section">
                <h4>The Groups:</h4>
                <p><strong>Location:</strong> Urban vs. Rural households.</p>
                <p><strong>Child Sex:</strong> Male vs. Female infants.</p>
            </div>
            <div class="explanation-section">
                <h4>How to read it?</h4>
                <p>The colored bars represent your selected region. The dark gray bars represent the National Average. Look for gaps where specific groups (e.g., Urban areas) might be underperforming.</p>
            </div>
        `
    },
    scatter: {
        title: "📉 Age Drop-off Analysis",
        content: `
            <div class="explanation-section">
                <h4>What does this show?</h4>
                <p>This tracks how EBF adherence changes as the infant grows older (from 0 to 5 months).</p>
            </div>
            <div class="explanation-section">
                <h4>How to read it?</h4>
                <p><strong>X-Axis:</strong> Infant Age (0, 1, 2, 3, 4, 5 months).</p>
                <p><strong>Y-Axis:</strong> EBF Rate (%).</p>
            </div>
            <div class="explanation-section">
                <h4>What is good?</h4>
                <p>Ideally, the line should remain high and flat. A steep downward slope indicates mothers stop breastfeeding exclusively as the baby gets older (often around month 4 or 5).</p>
            </div>
        `
    },
    pie: {
        title: "💰 Wealth Distribution",
        content: `
            <div class="explanation-section">
                <h4>What does this show?</h4>
                <p>The socio-economic breakdown of the surveyed population in this region.</p>
            </div>
            <div class="explanation-section">
                <h4>The Quintiles:</h4>
                <p>The population is divided into 5 groups ranging from <strong>Poorest</strong> to <strong>Richest</strong>.</p>
            </div>
            <div class="explanation-section">
                <h4>Why it matters?</h4>
                <p>Understanding the economic background helps identify if malnutrition or low adherence is linked to poverty or specific wealth classes.</p>
            </div>
        `
    },
    bar: {
        title: "🏆 Leaderboard",
        content: `
            <div class="explanation-section">
                <h4>What does this show?</h4>
                <p>A ranking of all regions from highest EBF rate to lowest for the selected year.</p>
            </div>
            <div class="explanation-section">
                <h4>Color Guide:</h4>
                <p><strong>Green:</strong> >50% Adherence (Doing Well).</p>
                <p><strong>Orange:</strong> 30% - 50% (Needs Improvement).</p>
                <p><strong>Red:</strong> <30% (Critical).</p>
            </div>
        `
    },
    heatmap: {
        title: "📅 Yearly Matrix",
        content: `
            <div class="explanation-section">
                <h4>What does this show?</h4>
                <p>A bird's-eye view of every region's performance across all survey years.</p>
            </div>
            <div class="explanation-section">
                <h4>How to read it?</h4>
                <p>Read rows left-to-right to see if a specific region is improving (getting greener) or declining (turning orange/red) over the years.</p>
            </div>
        `
    }
};

function setupChartInfoModals() {
    const modal = document.getElementById('chartExplanationModal');
    const titleEl = document.getElementById('explanationTitle');
    const bodyEl = document.getElementById('explanationBody');
    const closeBtn = document.querySelector('.close-explanation');

    const hideModal = () => {
        if (!modal) return;
        modal.classList.add("hiding");
        setTimeout(() => {
            modal.style.display = "none";
            modal.classList.remove("hiding");
        }, 300);
    };

    if (closeBtn) closeBtn.onclick = hideModal;

    window.addEventListener('click', (e) => {
        if (e.target === modal) hideModal();
    });

    document.querySelectorAll('.chart-info-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const type = btn.dataset.chart;
            const data = chartInfoData[type];

            if (data) {
                if (titleEl) titleEl.innerText = data.title;
                if (bodyEl) bodyEl.innerHTML = data.content;
                if (modal) modal.style.display = 'block';
            } else {
                console.warn(`No info data found for chart type: ${type}`);
            }
        });
    });
}

function setupGlobalKeyboardShortcuts() {
    document.addEventListener('keyup', function(event) {
        if (event.key === 'Escape') {
            document.querySelectorAll('.modal-overlay').forEach(m => {
                if (m.style.display === 'block') closeModal(m);
            });
        }
    });
}

document.addEventListener("DOMContentLoaded", function() {
    const downloadRankingsBtn = document.getElementById('downloadRankingsBtn');
    if (downloadRankingsBtn) {
        downloadRankingsBtn.addEventListener("click", function() {
            let selectedYear = parseInt(document.getElementById('yearFilter').value);
            let rankedData = [...globalData].map(r => {
                let h = r.history.find(i => i.year === selectedYear);
                return {
                    Region: r.Region,
                    Year: selectedYear,
                    Rate: h ? h.value : 0
                };
            }).filter(x => x.Rate > 0).sort((a, b) => b.Rate - a.Rate);

            var csv = Papa.unparse(rankedData);
            var blob = new Blob([csv], {
                type: "text/csv;charset=utf-8;"
            });
            var link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `ebf_rankings_${selectedYear}.csv`;
            link.click();
        });
    }
    setupGlobalKeyboardShortcuts();
});

document.getElementById("downloadBtn").addEventListener("click", function() {
    const exportData = rawCsvData.map(row => ({
        Region: row.Region,
        EBF_Rate: row.EBF_Rate,
        Year: row.Year,
        Type: row.Type,
        Education: row.Education,
        Age_Month: row.Age_Month,
        Wealth_Index: row.Wealth_Index,
        Child_Sex: row.Child_Sex
    }));

    var csv = Papa.unparse(exportData);
    var blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;"
    });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "ebf_full_raw_data.csv";
    link.click();
});