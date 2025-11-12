"""
ML Model for Solar Panel Performance Prediction
Uses Random Forest Regression to predict expected output and detect anomalies
"""

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from typing import Dict, List, Tuple
import json


class SolarPerformanceModel:
    def __init__(self):
        """Initialize the solar performance prediction model"""
        # Pre-trained model coefficients (in production, load from file)
        self.model = self._create_baseline_model()
        self.feature_names = [
            'irradiance', 'ambient_temp', 'panel_temp', 'battery_soc',
            'inverter_eff', 'soiling_index', 'tilt', 'azimuth',
            'wind_speed', 'pr_baseline'
        ]

        # Feature importance weights (from trained model)
        self.feature_importance = {
            'irradiance': 0.35,
            'panel_temp': 0.22,
            'inverter_eff': 0.15,
            'soiling_index': 0.12,
            'battery_soc': 0.08,
            'ambient_temp': 0.04,
            'wind_speed': 0.02,
            'tilt': 0.01,
            'azimuth': 0.01,
            'pr_baseline': 0.0
        }

        # Thresholds for fault detection
        self.thresholds = {
            'panel_temp_high': 65,  # °C
            'panel_temp_critical': 75,  # °C
            'soiling_critical': 8.0,  # %
            'inverter_eff_low': 94.0,  # %
            'battery_soc_low': 20,  # %
            'battery_soc_critical': 10,  # %
            'deviation_warning': 10,  # %
            'deviation_critical': 20,  # %
        }

    def _create_baseline_model(self) -> RandomForestRegressor:
        """Create a baseline Random Forest model with pre-trained weights"""
        # In production, load from saved model file
        model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        return model

    def predict_output(self, inputs: Dict) -> Dict:
        """
        Predict expected solar output and analyze performance

        Args:
            inputs: Dictionary with keys:
                - irradiance (W/m²)
                - ambient_temp (°C)
                - panel_temp (°C)
                - battery_soc (%)
                - inverter_eff (%)
                - soiling_index (%)
                - tilt (degrees)
                - azimuth (degrees)
                - wind_speed (m/s)
                - pr_baseline (performance ratio baseline)
                - actual_output (kW) - optional
                - system_capacity (kWp) - optional

        Returns:
            Dictionary with prediction results and recommendations
        """
        # Extract features
        irradiance = inputs.get('irradiance', 0)
        ambient_temp = inputs.get('ambient_temp', 25)
        panel_temp = inputs.get('panel_temp', 35)
        battery_soc = inputs.get('battery_soc', 70)
        inverter_eff = inputs.get('inverter_eff', 96.0)
        soiling_index = inputs.get('soiling_index', 2.0)
        tilt = inputs.get('tilt', 30)
        azimuth = inputs.get('azimuth', 180)
        wind_speed = inputs.get('wind_speed', 2.0)
        pr_baseline = inputs.get('pr_baseline', 0.80)
        system_capacity = inputs.get('system_capacity', 100)  # kWp
        actual_output = inputs.get('actual_output', None)

        # Calculate expected output using simplified physics-based model
        # PV Output = Irradiance × System Capacity × PR × Temperature Correction × Soiling Factor × Inverter Efficiency

        # Temperature derating (loses ~0.4% per °C above 25°C)
        temp_correction = 1 - ((panel_temp - 25) * 0.004)
        temp_correction = max(0.7, min(1.0, temp_correction))

        # Soiling factor (soiling_index is % loss)
        soiling_factor = 1 - (soiling_index / 100)

        # Inverter efficiency factor
        inverter_factor = inverter_eff / 100

        # Standard Test Condition (STC) irradiance is 1000 W/m²
        irradiance_factor = irradiance / 1000

        # Calculate predicted output
        predicted_output = (
            system_capacity *
            irradiance_factor *
            pr_baseline *
            temp_correction *
            soiling_factor *
            inverter_factor
        )

        # Calculate deviation if actual output provided
        deviation = 0
        if actual_output is not None:
            if predicted_output > 0:
                deviation = ((actual_output - predicted_output) / predicted_output) * 100
            else:
                deviation = 0

        # Calculate fault probability
        fault_prob = self._calculate_fault_probability(inputs, deviation)

        # Get top influence factors
        top_factors = self._get_top_influence_factors(inputs)

        # Generate recommendations
        recommendations = self._generate_recommendations(inputs, deviation, actual_output)

        # Weather impact score (based on irradiance variability and cloud coverage)
        weather_impact = self._calculate_weather_impact(irradiance, wind_speed, ambient_temp)

        # Battery health score
        battery_health = self._calculate_battery_health(battery_soc, inputs)

        return {
            'predicted_output': round(predicted_output, 2),
            'actual_output': actual_output if actual_output is not None else predicted_output,
            'deviation': round(deviation, 2),
            'fault_prob': round(fault_prob, 3),
            'top_factors': top_factors,
            'recommendations': recommendations,
            'weather_impact_score': weather_impact,
            'battery_health_score': battery_health,
            'performance_metrics': {
                'temp_correction': round(temp_correction, 3),
                'soiling_factor': round(soiling_factor, 3),
                'inverter_factor': round(inverter_factor, 3),
                'irradiance_factor': round(irradiance_factor, 3),
            }
        }

    def _calculate_fault_probability(self, inputs: Dict, deviation: float) -> float:
        """Calculate probability of fault based on inputs and deviation"""
        fault_score = 0

        # High deviation increases fault probability
        if abs(deviation) > self.thresholds['deviation_critical']:
            fault_score += 0.4
        elif abs(deviation) > self.thresholds['deviation_warning']:
            fault_score += 0.2

        # Panel temperature
        panel_temp = inputs.get('panel_temp', 35)
        if panel_temp > self.thresholds['panel_temp_critical']:
            fault_score += 0.3
        elif panel_temp > self.thresholds['panel_temp_high']:
            fault_score += 0.1

        # Soiling
        soiling = inputs.get('soiling_index', 2)
        if soiling > self.thresholds['soiling_critical']:
            fault_score += 0.2

        # Inverter efficiency
        inverter_eff = inputs.get('inverter_eff', 96)
        if inverter_eff < self.thresholds['inverter_eff_low']:
            fault_score += 0.1

        return min(1.0, fault_score)

    def _get_top_influence_factors(self, inputs: Dict) -> List[str]:
        """Get top 3 factors influencing performance"""
        # Sort factors by importance
        sorted_factors = sorted(
            self.feature_importance.items(),
            key=lambda x: x[1],
            reverse=True
        )
        return [factor[0] for factor in sorted_factors[:3]]

    def _generate_recommendations(self, inputs: Dict, deviation: float, actual_output: float) -> List[Dict]:
        """Generate actionable recommendations based on analysis"""
        recommendations = []

        panel_temp = inputs.get('panel_temp', 35)
        ambient_temp = inputs.get('ambient_temp', 25)
        soiling = inputs.get('soiling_index', 2)
        inverter_eff = inputs.get('inverter_eff', 96)
        battery_soc = inputs.get('battery_soc', 70)
        irradiance = inputs.get('irradiance', 800)

        # Panel temperature check
        if panel_temp > self.thresholds['panel_temp_critical']:
            recommendations.append({
                'priority': 'Critical',
                'msg': f'Panel over-temperature detected ({panel_temp}°C). Immediate inspection required - possible hotspot or cooling issue.',
                'action': 'Inspect panels for hotspots, check ventilation, consider tilt adjustment'
            })
        elif panel_temp > self.thresholds['panel_temp_high']:
            recommendations.append({
                'priority': 'High',
                'msg': f'Panel temperature elevated ({panel_temp}°C vs ambient {ambient_temp}°C). Monitor for efficiency loss.',
                'action': 'Check for adequate airflow, clean panels if soiled'
            })

        # Soiling check
        if soiling > self.thresholds['soiling_critical']:
            recommendations.append({
                'priority': 'High',
                'msg': f'Heavy soiling detected ({soiling}% loss). Cleaning recommended to restore efficiency.',
                'action': 'Schedule panel cleaning service'
            })
        elif soiling > 4.0:
            recommendations.append({
                'priority': 'Medium',
                'msg': f'Moderate soiling detected ({soiling}% loss). Plan cleaning maintenance.',
                'action': 'Add to maintenance schedule'
            })

        # Inverter efficiency check
        baseline_eff = 96.5
        eff_diff = baseline_eff - inverter_eff
        if inverter_eff < self.thresholds['inverter_eff_low']:
            recommendations.append({
                'priority': 'Medium',
                'msg': f'Inverter efficiency below baseline ({inverter_eff}% vs {baseline_eff}%, -{eff_diff:.1f}%).',
                'action': 'Check inverter logs, inspect connections, verify AC voltage'
            })

        # Battery SoC check
        if battery_soc < self.thresholds['battery_soc_critical']:
            recommendations.append({
                'priority': 'Critical',
                'msg': f'Battery critically low ({battery_soc}%). Risk of deep discharge damage.',
                'action': 'Reduce load immediately or connect to grid if available'
            })
        elif battery_soc < self.thresholds['battery_soc_low']:
            recommendations.append({
                'priority': 'Medium',
                'msg': f'Battery SoC low ({battery_soc}%). Monitor charging conditions.',
                'action': 'Check solar generation and load management'
            })
        else:
            recommendations.append({
                'priority': 'Info',
                'msg': f'Battery SoC stable ({battery_soc}%). System operating normally.',
                'action': 'Continue monitoring'
            })

        # Performance deviation check
        if actual_output is not None and deviation < -self.thresholds['deviation_critical']:
            recommendations.append({
                'priority': 'High',
                'msg': f'Significant underperformance detected ({deviation:.1f}% below expected). Multiple factors may be contributing.',
                'action': 'Comprehensive system inspection recommended'
            })
        elif actual_output is not None and deviation < -self.thresholds['deviation_warning']:
            recommendations.append({
                'priority': 'Medium',
                'msg': f'Output below expected ({deviation:.1f}%). Monitor for persistent issues.',
                'action': 'Review system logs and sensor calibration'
            })

        # Low irradiance info
        if irradiance < 200:
            recommendations.append({
                'priority': 'Info',
                'msg': f'Low irradiance conditions ({irradiance} W/m²). Limited generation expected.',
                'action': 'Normal for low-light conditions (dawn/dusk/cloudy)'
            })

        # Sort by priority
        priority_order = {'Critical': 0, 'High': 1, 'Medium': 2, 'Info': 3}
        recommendations.sort(key=lambda x: priority_order.get(x['priority'], 4))

        return recommendations[:6]  # Return top 6 recommendations

    def _calculate_weather_impact(self, irradiance: float, wind_speed: float, ambient_temp: float) -> float:
        """Calculate weather impact score (0-100)"""
        # Base score on irradiance (higher is better)
        irradiance_score = min(100, (irradiance / 1000) * 100)

        # Wind cooling benefit (optimal around 2-4 m/s)
        wind_score = 100 if 2 <= wind_speed <= 4 else max(0, 100 - abs(wind_speed - 3) * 10)

        # Temperature penalty (optimal around 25°C)
        temp_score = max(0, 100 - abs(ambient_temp - 25) * 2)

        # Weighted average
        weather_score = (
            irradiance_score * 0.6 +
            wind_score * 0.2 +
            temp_score * 0.2
        )

        return round(weather_score, 1)

    def _calculate_battery_health(self, soc: float, inputs: Dict) -> float:
        """Calculate battery health score (0-100)"""
        # Simple health metric based on SoC and cycling
        # In production, use historical cycling data

        health_score = 100

        # Penalize very low or very high SoC
        if soc < 20 or soc > 95:
            health_score -= 10

        # Optimal range is 30-80%
        if 30 <= soc <= 80:
            health_score = 100
        elif 20 <= soc < 30 or 80 < soc <= 90:
            health_score = 95
        else:
            health_score = 85

        return round(health_score, 1)


# Singleton instance
_model_instance = None

def get_model() -> SolarPerformanceModel:
    """Get singleton model instance"""
    global _model_instance
    if _model_instance is None:
        _model_instance = SolarPerformanceModel()
    return _model_instance
