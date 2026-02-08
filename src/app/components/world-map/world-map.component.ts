import {
  Component,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
  HostListener,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import worldData from 'world-atlas/countries-110m.json';
import { ISO_TO_COUNTRY } from '../../data/country-iso-mapping';
import { CapService } from '../../services/cap.service';
import { Cap } from '../../models/cap.model';

interface MapFeature {
  id: string;
  name: string;
  path: string;
  count: number;
  fill: string;
}

@Component({
  selector: 'app-world-map',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './world-map.component.html',
  styleUrls: ['./world-map.component.scss'],
})
export class WorldMapComponent implements OnInit, OnDestroy, AfterViewInit {
  @Output() countryClick = new EventEmitter<string>();
  @ViewChild('svgEl') svgEl!: ElementRef<SVGSVGElement>;

  features: MapFeature[] = [];
  tooltip: { name: string; count: number } | null = null;
  tooltipX = 0;
  tooltipY = 0;
  hoveredId: string | null = null;

  // Zoom & pan state
  scale = 1;
  translateX = 0;
  translateY = 0;
  readonly minScale = 1;
  readonly maxScale = 12;
  isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panStartTx = 0;
  private panStartTy = 0;

  // Touch zoom
  private lastPinchDist = 0;

  // SVG internal dimensions
  private readonly svgW = 960;
  private readonly svgH = 500;

  private destroy$ = new Subject<void>();
  private pathStrings = new Map<string, string>();
  private geoNames = new Map<string, string>();

  constructor(private capService: CapService) {}

  ngOnInit(): void {
    this.initGeometry();
    this.capService.caps$.pipe(takeUntil(this.destroy$)).subscribe((caps) => {
      this.updateFeatures(caps);
    });
  }

  ngAfterViewInit(): void {
    // Prevent default scroll on the SVG wrapper so wheel only zooms
    const wrapper = this.svgEl?.nativeElement?.parentElement;
    if (wrapper) {
      wrapper.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get transform(): string {
    return `translate(${this.translateX} ${this.translateY}) scale(${this.scale})`;
  }

  get strokeWidth(): number {
    return 0.4 / this.scale;
  }

  get zoomPercent(): number {
    return Math.round(this.scale * 100);
  }

  // ─── Geometry ───────────────────────────────

  private initGeometry(): void {
    const projection = geoNaturalEarth1().scale(153).translate([480, 250]);
    const pathGen = geoPath().projection(projection);

    const worldTopo = worldData as any;
    const geojson = feature(worldTopo, worldTopo.objects.countries) as any;

    for (const f of geojson.features) {
      const id = f.id as string;
      if (!id || id === '010') continue;
      const name = ISO_TO_COUNTRY[id] || '';
      const pathStr = pathGen(f as any) || '';
      this.pathStrings.set(id, pathStr);
      this.geoNames.set(id, name);
    }
  }

  private updateFeatures(caps: Cap[]): void {
    const countryCounts = new Map<string, number>();
    for (const cap of caps) {
      const country = cap.country || 'Unknown';
      countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
    }

    const maxCount = Math.max(1, ...Array.from(countryCounts.values()));

    this.features = [];
    for (const [id, path] of this.pathStrings) {
      const name = this.geoNames.get(id) || '';
      const count = name ? countryCounts.get(name) || 0 : 0;
      this.features.push({
        id,
        name,
        path,
        count,
        fill: this.getColor(count, maxCount),
      });
    }
  }

  private getColor(count: number, maxCount: number): string {
    if (count === 0) return '#2d3748';
    const t = Math.log(count + 1) / Math.log(maxCount + 1);
    const r = Math.round(246 + (192 - 246) * t);
    const g = Math.round(224 + (86 - 224) * t);
    const b = Math.round(94 + (33 - 94) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  // ─── Hover & Click ──────────────────────────

  getHoverColor(feat: MapFeature): string {
    if (feat.count === 0) return '#4a5568';
    return '#f5c542';
  }

  onMouseEnter(feat: MapFeature): void {
    if (this.isPanning) return;
    this.hoveredId = feat.id;
    if (feat.name) {
      this.tooltip = { name: feat.name, count: feat.count };
    }
  }

  onMouseLeave(): void {
    this.hoveredId = null;
    this.tooltip = null;
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.tooltip) {
      this.tooltipX = event.clientX + 14;
      this.tooltipY = event.clientY - 10;
    }
  }

  onCountryClicked(feat: MapFeature): void {
    if (this.isPanning) return;
    if (feat.name && feat.count > 0) {
      this.countryClick.emit(feat.name);
    }
  }

  // ─── Zoom (Mouse Wheel) ─────────────────────

  onWheel(event: WheelEvent): void {
    const zoomFactor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.zoomAtPoint(event, zoomFactor);
  }

  private zoomAtPoint(event: MouseEvent | WheelEvent, factor: number): void {
    const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
    if (newScale === this.scale) return;

    // Get mouse position in SVG coordinate space
    const svgRect = this.svgEl.nativeElement.getBoundingClientRect();
    const mouseX = ((event.clientX - svgRect.left) / svgRect.width) * this.svgW;
    const mouseY = ((event.clientY - svgRect.top) / svgRect.height) * this.svgH;

    // Adjust translation so zoom centers on mouse
    const ratio = newScale / this.scale;
    this.translateX = mouseX - ratio * (mouseX - this.translateX);
    this.translateY = mouseY - ratio * (mouseY - this.translateY);
    this.scale = newScale;

    this.clampTranslation();
  }

  // ─── Pan (Mouse Drag) ──────────────────────

  onPanStart(event: MouseEvent): void {
    if (event.button !== 0) return; // only left click
    this.isPanning = true;
    this.panStartX = event.clientX;
    this.panStartY = event.clientY;
    this.panStartTx = this.translateX;
    this.panStartTy = this.translateY;
    this.tooltip = null;
  }

  @HostListener('document:mousemove', ['$event'])
  onPanMove(event: MouseEvent): void {
    if (!this.isPanning) return;

    const svgRect = this.svgEl.nativeElement.getBoundingClientRect();
    const dx = ((event.clientX - this.panStartX) / svgRect.width) * this.svgW;
    const dy = ((event.clientY - this.panStartY) / svgRect.height) * this.svgH;

    this.translateX = this.panStartTx + dx;
    this.translateY = this.panStartTy + dy;
    this.clampTranslation();
  }

  @HostListener('document:mouseup')
  onPanEnd(): void {
    // Use timeout so the click event on country doesn't fire immediately after pan
    if (this.isPanning) {
      setTimeout(() => (this.isPanning = false), 50);
    }
  }

  // ─── Touch Support ──────────────────────────

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.isPanning = true;
      this.panStartX = event.touches[0].clientX;
      this.panStartY = event.touches[0].clientY;
      this.panStartTx = this.translateX;
      this.panStartTy = this.translateY;
    } else if (event.touches.length === 2) {
      this.lastPinchDist = this.getPinchDist(event);
    }
  }

  onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    if (event.touches.length === 1 && this.isPanning) {
      const svgRect = this.svgEl.nativeElement.getBoundingClientRect();
      const dx =
        ((event.touches[0].clientX - this.panStartX) / svgRect.width) * this.svgW;
      const dy =
        ((event.touches[0].clientY - this.panStartY) / svgRect.height) * this.svgH;
      this.translateX = this.panStartTx + dx;
      this.translateY = this.panStartTy + dy;
      this.clampTranslation();
    } else if (event.touches.length === 2) {
      const dist = this.getPinchDist(event);
      if (this.lastPinchDist > 0) {
        const factor = dist / this.lastPinchDist;
        const cx =
          (event.touches[0].clientX + event.touches[1].clientX) / 2;
        const cy =
          (event.touches[0].clientY + event.touches[1].clientY) / 2;

        const svgRect = this.svgEl.nativeElement.getBoundingClientRect();
        const mouseX = ((cx - svgRect.left) / svgRect.width) * this.svgW;
        const mouseY = ((cy - svgRect.top) / svgRect.height) * this.svgH;

        const newScale = Math.min(
          this.maxScale,
          Math.max(this.minScale, this.scale * factor)
        );
        const ratio = newScale / this.scale;
        this.translateX = mouseX - ratio * (mouseX - this.translateX);
        this.translateY = mouseY - ratio * (mouseY - this.translateY);
        this.scale = newScale;
        this.clampTranslation();
      }
      this.lastPinchDist = dist;
    }
  }

  onTouchEnd(): void {
    this.isPanning = false;
    this.lastPinchDist = 0;
  }

  private getPinchDist(e: TouchEvent): number {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ─── Zoom Controls ─────────────────────────

  zoomIn(): void {
    const newScale = Math.min(this.maxScale, this.scale * 1.4);
    this.zoomToCenter(newScale);
  }

  zoomOut(): void {
    const newScale = Math.max(this.minScale, this.scale / 1.4);
    this.zoomToCenter(newScale);
  }

  resetZoom(): void {
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
  }

  private zoomToCenter(newScale: number): void {
    const cx = this.svgW / 2;
    const cy = this.svgH / 2;
    const ratio = newScale / this.scale;
    this.translateX = cx - ratio * (cx - this.translateX);
    this.translateY = cy - ratio * (cy - this.translateY);
    this.scale = newScale;
    this.clampTranslation();
  }

  private clampTranslation(): void {
    // Allow some overflow but prevent losing the map entirely
    const margin = 100;
    const maxTx = margin;
    const minTx = -(this.svgW * this.scale - this.svgW) - margin;
    const maxTy = margin;
    const minTy = -(this.svgH * this.scale - this.svgH) - margin;

    this.translateX = Math.min(maxTx, Math.max(minTx, this.translateX));
    this.translateY = Math.min(maxTy, Math.max(minTy, this.translateY));
  }
}
