/**
 * YOLO Analyzer - Solar Panel Defect Detection
 * Integrates with Qualcomm AI Hub YOLOv11 model
 * Model: https://github.com/quic/ai-hub-models/blob/main/qai_hub_models/models/yolov11_det
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

export class YOLOAnalyzer {
  constructor() {
    this.modelVersion = 'yolov11_det';
    this.mockMode = process.env.MOCK_YOLO !== 'false'; // Default to mock for demo
    this.supabase = null;

    // Defect detection thresholds
    this.severityThresholds = {
      hotspot: { critical: 90, high: 75, medium: 60, low: 40 },
      crack: { critical: 85, high: 70, medium: 55, low: 35 },
      delamination: { critical: 80, high: 65, medium: 50, low: 30 },
      broken_cell: { critical: 95, high: 80, medium: 65, low: 40 },
      physical_damage: { critical: 90, high: 75, medium: 60, low: 35 },
      connection_issue: { critical: 85, high: 70, medium: 55, low: 30 },
      pid_effect: { critical: 75, high: 60, medium: 45, low: 25 },
      soiling: { critical: 60, high: 45, medium: 30, low: 15 },
      discoloration: { critical: 70, high: 55, medium: 40, low: 20 },
      snail_trail: { critical: 65, high: 50, medium: 35, low: 15 }
    };

    // Action recommendations
    this.actionRecommendations = {
      hotspot: 'Immediate inspection required. Hotspots can lead to fire hazards. Check bypass diodes and electrical connections.',
      crack: 'Schedule panel replacement. Cracks reduce efficiency and can worsen over time, allowing moisture ingress.',
      delamination: 'Monitor closely. Delamination indicates adhesive failure. Replace if expanding rapidly.',
      broken_cell: 'Replace panel immediately. Broken cells create electrical imbalances and reduce string performance.',
      physical_damage: 'Inspect for structural integrity. Physical damage may compromise waterproofing and electrical safety.',
      connection_issue: 'Check cable connections and junction boxes. Loose connections cause power loss and fire risk.',
      pid_effect: 'Voltage-induced degradation detected. Review system grounding and consider PID recovery procedures.',
      soiling: 'Schedule cleaning maintenance. Heavy soiling reduces output by 5-20%. Clean panels for optimal performance.',
      discoloration: 'Monitor panel health. Discoloration may indicate UV degradation or manufacturing defects.',
      snail_trail: 'Cosmetic issue from silver paste corrosion. Monitor for power degradation. May require replacement if performance drops.'
    };
  }

  /**
   * Initialize analyzer with Supabase connection
   */
  async initialize() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      console.log('✅ YOLO Analyzer initialized');
    }

    if (this.mockMode) {
      console.log('⚠️  YOLO Analyzer in MOCK mode (demo data)');
    } else {
      console.log('🤖 YOLO Analyzer ready for real inference');
    }
  }

  /**
   * Analyze image for defects using YOLO model
   */
  async analyzeImage(imageId, imagePath) {
    const startTime = Date.now();

    try {
      console.log(`🔍 Analyzing image ${imageId}...`);

      // Update status to processing
      await this.updateImageStatus(imageId, 'processing');

      let detections;

      if (this.mockMode) {
        // Mock detection for demo
        detections = this.generateMockDetections();
      } else {
        // Real YOLO inference
        detections = await this.runYOLOInference(imagePath);
      }

      const inferenceTime = Date.now() - startTime;

      // Store raw YOLO results
      await this.storeInferenceResults(imageId, detections, inferenceTime);

      // Process detections into defects
      const defects = await this.processDetections(imageId, detections);

      // Update image status
      await this.updateImageStatus(imageId, 'completed');

      console.log(`✅ Analysis complete: ${defects.length} defects detected in ${inferenceTime}ms`);

      return {
        success: true,
        imageId,
        defectsCount: defects.length,
        inferenceTime,
        defects
      };

    } catch (error) {
      console.error('❌ Analysis error:', error);
      await this.updateImageStatus(imageId, 'failed');

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Run real YOLO inference (Qualcomm AI Hub)
   */
  async runYOLOInference(imagePath) {
    // TODO: Integrate with Qualcomm AI Hub API
    // For production, you would:
    // 1. Install qai_hub_models package
    // 2. Load the YOLOv11 model
    // 3. Run inference on the image
    // 4. Parse and return detections

    /*
    Example integration (pseudo-code):

    const { QAIHubModel } = require('qai_hub_models');

    const model = await QAIHubModel.load('yolov11_det');
    const image = await this.loadImage(imagePath);
    const results = await model.predict(image);

    return results.detections.map(det => ({
      class: det.class,
      confidence: det.confidence,
      bbox: det.bbox
    }));
    */

    throw new Error('Real YOLO inference not yet implemented. Set MOCK_YOLO=true for demo.');
  }

  /**
   * Generate mock detections for demo
   */
  generateMockDetections() {
    const defectTypes = ['hotspot', 'crack', 'soiling', 'discoloration', 'snail_trail'];
    const numDefects = Math.floor(Math.random() * 4) + 1; // 1-4 defects

    const detections = [];

    for (let i = 0; i < numDefects; i++) {
      const defectType = defectTypes[Math.floor(Math.random() * defectTypes.length)];
      const confidence = 60 + Math.random() * 35; // 60-95% confidence

      detections.push({
        class: defectType,
        confidence: parseFloat(confidence.toFixed(2)),
        bbox: {
          x: Math.floor(Math.random() * 500),
          y: Math.floor(Math.random() * 500),
          width: 50 + Math.floor(Math.random() * 100),
          height: 50 + Math.floor(Math.random() * 100)
        }
      });
    }

    return detections;
  }

  /**
   * Process YOLO detections into defect records
   */
  async processDetections(imageId, detections) {
    if (!this.supabase) {
      throw new Error('Supabase not initialized');
    }

    const defects = [];

    for (const detection of detections) {
      const severity = this.calculateSeverity(detection.class, detection.confidence);
      const description = this.generateDescription(detection.class, detection.confidence);
      const recommendation = this.actionRecommendations[detection.class] || 'Inspect panel for issues.';

      const { data, error } = await this.supabase
        .from('detected_defects')
        .insert({
          image_id: imageId,
          defect_type: detection.class,
          severity,
          confidence: detection.confidence,
          bounding_box: detection.bbox,
          description,
          recommended_action: recommendation
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting defect:', error);
        continue;
      }

      defects.push(data);

      // Log high severity defects
      if (severity === 'critical' || severity === 'high') {
        console.log(`⚠️  ${severity.toUpperCase()}: ${description}`);
      }
    }

    return defects;
  }

  /**
   * Calculate severity based on defect type and confidence
   */
  calculateSeverity(defectType, confidence) {
    const thresholds = this.severityThresholds[defectType] || {
      critical: 90, high: 75, medium: 60, low: 40
    };

    if (confidence >= thresholds.critical) return 'critical';
    if (confidence >= thresholds.high) return 'high';
    if (confidence >= thresholds.medium) return 'medium';
    if (confidence >= thresholds.low) return 'low';
    return 'info';
  }

  /**
   * Generate human-readable description
   */
  generateDescription(defectType, confidence) {
    const defectName = defectType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    const descriptions = {
      hotspot: `${defectName} detected with ${confidence}% confidence. Panel temperature anomaly indicates potential electrical fault or shading issue.`,
      crack: `${defectName} detected with ${confidence}% confidence. Physical crack in solar cell may lead to moisture ingress and power loss.`,
      delamination: `${defectName} detected with ${confidence}% confidence. Separation of panel layers detected, indicating adhesive failure.`,
      broken_cell: `${defectName} detected with ${confidence}% confidence. Fractured solar cell causing electrical imbalance and efficiency loss.`,
      physical_damage: `${defectName} detected with ${confidence}% confidence. Physical impact or structural damage to panel surface.`,
      connection_issue: `${defectName} detected with ${confidence}% confidence. Electrical connection problem in junction box or cables.`,
      pid_effect: `${defectName} detected with ${confidence}% confidence. Potential-Induced Degradation causing performance loss.`,
      soiling: `${defectName} detected with ${confidence}% confidence. Dust, dirt, or debris accumulation reducing panel efficiency.`,
      discoloration: `${defectName} detected with ${confidence}% confidence. Color change indicating UV degradation or manufacturing defect.`,
      snail_trail: `${defectName} detected with ${confidence}% confidence. Silver paste corrosion visible as brown trails on cell surface.`
    };

    return descriptions[defectType] || `${defectName} detected with ${confidence}% confidence.`;
  }

  /**
   * Store raw YOLO inference results
   */
  async storeInferenceResults(imageId, detections, inferenceTime) {
    if (!this.supabase) return;

    try {
      await this.supabase
        .from('yolo_inference_results')
        .insert({
          image_id: imageId,
          model_version: this.modelVersion,
          inference_time_ms: inferenceTime,
          raw_output: {
            detections,
            model: this.modelVersion,
            timestamp: new Date().toISOString()
          }
        });
    } catch (error) {
      console.error('Error storing inference results:', error);
    }
  }

  /**
   * Update image analysis status
   */
  async updateImageStatus(imageId, status) {
    if (!this.supabase) return;

    try {
      const updates = { analysis_status: status };

      if (status === 'completed' || status === 'failed') {
        updates.analyzed_at = new Date().toISOString();
      }

      await this.supabase
        .from('panel_images')
        .update(updates)
        .eq('id', imageId);
    } catch (error) {
      console.error('Error updating image status:', error);
    }
  }

  /**
   * Get defects summary for an image
   */
  async getDefectsSummary(imageId) {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .from('detected_defects')
        .select('*')
        .eq('image_id', imageId)
        .order('severity', { ascending: false });

      if (error) throw error;

      const summary = {
        total: data.length,
        critical: data.filter(d => d.severity === 'critical').length,
        high: data.filter(d => d.severity === 'high').length,
        medium: data.filter(d => d.severity === 'medium').length,
        low: data.filter(d => d.severity === 'low').length,
        defects: data
      };

      return summary;
    } catch (error) {
      console.error('Error getting defects summary:', error);
      return null;
    }
  }

  /**
   * Load image from file system (for real inference)
   */
  async loadImage(imagePath) {
    return new Promise((resolve, reject) => {
      fs.readFile(imagePath, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }
}

// Export singleton instance
export const yoloAnalyzer = new YOLOAnalyzer();
