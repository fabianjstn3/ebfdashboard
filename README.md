# 🇵🇭 Breastfeeding Adherence Monitor

An interactive data visualization dashboard monitoring Exclusive Breastfeeding (EBF) rates across the Philippines. This tool empowers health officials and policymakers to track regional progress against national targets using real data from the Philippines National Demographic and Health Survey (NDHS).

## 📊 Data Sources

* **Source:** Philippines National Demographic and Health Survey (NDHS) for **2017 and 2022**.
* **Program:** The datasets are provided by the **Demographic and Health Surveys (DHS) Program**, which collects, analyzes, and disseminates accurate and representative data on population, health, HIV, and nutrition.
* **Indicator:** Exclusive Breastfeeding (EBF) Rate for **infants 0-5.9 months old**. This indicator measures the proportion of infants who received only breast milk during the previous day.
* **Data Granularity:** The dashboard utilizes a processed CSV dataset (`ebf_data.csv`) containing regional aggregates that allow for cross-analysis by:
    * **Geography:** Urban vs. Rural
    * **Demographics:** Male vs. Female Infants
    * **Socio-economic Status:** Wealth Index Quintiles (Poorest to Richest)
    * **Age Trend:** Month-by-month drop-off analysis (0 to 5 months)

## 🚀 Live Demo

[Breastfeeding Adherence Monitor](https://fabianjstn3.github.io/ebfdashboard)

## ✨ Features

* **Interactive Choropleth Map:** Powered by **amCharts 5**, visualizing EBF rates across all administrative regions.
    * **Green:** Good performance (>50%)
    * **Orange:** Average performance (30-50%)
    * **Red:** Critical (<30%)
* **Historical Trend Analysis:** A **Chart.js** line chart tracking regional progress against the National Average and the 70% Global Nutrition Target.
* **Demographic Profiling:**
    * **Bar Chart:** Compares adherence gaps between Urban/Rural areas and Male/Female infants.
    * **Pie Chart:** Visualizes the wealth index distribution of the surveyed population.
* **Age Drop-off Analysis:** A scatter/area plot showing how adherence declines as infants age from 0 to 5 months.
* **Data Export Tools:**
    * **Raw Data:** Download the full dataset for offline research.
    * **Rankings:** Export specific yearly regional rankings as CSV.
* **Smart Filtering:**
    * **Year Toggle:** Switch between 2017 and 2022 datasets.
    * **Choropleth Map Filtering:** Select a region by clicking a polygon on the map.
    * **Dynamic KPIs:** "Target Met" or "X% Away" indicators update instantly based on selection.
* **Dark Mode:** Fully responsive dark theme that adjusts map colors, chart grids, and UI elements for low-light viewing.
* **Regional Deep Dives:** Detailed modals for "Leaderboards" (Bar Chart) and "Yearly Matrix" (Heatmap) comparisons.

## 🛠️ Tech Stack

**Frontend** 
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

**Charting Engines** 
![amCharts 5](https://img.shields.io/badge/amCharts_5-FF6F00?style=for-the-badge&logo=chartdotjs&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)

**Data Processing** 
![PapaParse](https://img.shields.io/badge/PapaParse-4A90E2?style=for-the-badge&logo=javascript&logoColor=white)

**Fonts** 
![Google Fonts](https://img.shields.io/badge/Google_Fonts-Poppins-4285F4?style=for-the-badge&logo=googlefonts&logoColor=white)

## 📂 Project Structure
```
docs/
│
├── dashboard.html      # Dashboard backbone
├── script.js           # Application logic, data processing, and chart rendering
├── styles.css          # Styling and layout definitions
│
├── ph_regions.geojson  # Map geometry for Philippine regions
├── ebf_data.csv        # Source dataset (FNRI EBF Rates, ENNS Survey)
│
├── milk.svg            # Icon used for loader animation and favicon
└── README.md           # Project documentation
```

## 🚀 How to Run Locally

Because this project loads external data files (`.json` and `.csv`) via Fetch API, it requires a local server to bypass browser CORS (Cross-Origin Resource Sharing) restrictions.

### Option 1: Using VS Code (Recommended)
1.  Open the project folder in **VS Code**.
2.  Install the **Live Server** extension.
3.  Right-click `index.html` and select **"Open with Live Server"**.

### Option 2: Using Python

If you have Python installed, run a simple HTTP server from your terminal:

```bash
# For Python 3.x
python -m http.server 8000
```

Then navigate to `http://localhost:8000` in your browser.

## 📝 Configuration

You can adjust the color thresholds in `script.js` (inside the `updateMapVisuals` function) to match new health standards:
```

    newColor = am5.color("#27ae60"); //High

    newColor = am5.color("#f39c12"); //Medium

    newColor = am5.color("#c0392b"); //Low

```
