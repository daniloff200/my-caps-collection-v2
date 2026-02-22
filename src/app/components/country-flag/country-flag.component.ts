import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

const COUNTRY_TO_ALPHA2: Record<string, string> = {
  'Afghanistan': 'af', 'Aland Islands': 'ax', 'Albania': 'al', 'Algeria': 'dz',
  'American Samoa': 'as', 'Andorra': 'ad', 'Angola': 'ao', 'Antigua and Barbuda': 'ag',
  'Argentina': 'ar', 'Armenia': 'am', 'Aruba': 'aw', 'Australia': 'au',
  'Austria': 'at', 'Azerbaijan': 'az', 'Bahamas': 'bs', 'Bahrain': 'bh',
  'Bangladesh': 'bd', 'Barbados': 'bb', 'Belgium': 'be', 'Belize': 'bz',
  'Benin': 'bj', 'Bhutan': 'bt', 'Bolivia': 'bo', 'Bosnia and Herzegovina': 'ba',
  'Botswana': 'bw', 'Brazil': 'br', 'Bulgaria': 'bg', 'Burkina Faso': 'bf',
  'Burundi': 'bi', 'Cambodia': 'kh', 'Cameroon': 'cm', 'Canada': 'ca',
  'Cape Verde': 'cv', 'Cayman Islands': 'ky', 'Central African Republic': 'cf',
  'Chad': 'td', 'Chile': 'cl', 'China': 'cn', 'Colombia': 'co', 'Comoros': 'km',
  'Congo': 'cg', 'Costa Rica': 'cr', 'Croatia': 'hr', 'Cuba': 'cu', 'Curacao': 'cw',
  'Cyprus': 'cy', 'Czech Republic': 'cz', 'Democratic Republic of the Congo': 'cd',
  'Denmark': 'dk', 'Djibouti': 'dj', 'Dominica': 'dm', 'Dominican Republic': 'do',
  'Ecuador': 'ec', 'Egypt': 'eg', 'El Salvador': 'sv', 'Equatorial Guinea': 'gq',
  'Eritrea': 'er', 'Estonia': 'ee', 'Ethiopia': 'et', 'Faroe Islands': 'fo',
  'Fiji': 'fj', 'Finland': 'fi', 'France': 'fr', 'French Guiana': 'gf',
  'French Polynesia': 'pf', 'Gabon': 'ga', 'Gambia': 'gm', 'Georgia': 'ge',
  'Germany': 'de', 'Ghana': 'gh', 'Greece': 'gr', 'Greenland': 'gl', 'Grenada': 'gd',
  'Guadeloupe': 'gp', 'Guam': 'gu', 'Guatemala': 'gt', 'Guinea': 'gn',
  'Guinea-Bissau': 'gw', 'Guyana': 'gy', 'Haiti': 'ht', 'Honduras': 'hn',
  'Hong Kong': 'hk', 'Hungary': 'hu', 'Iceland': 'is', 'India': 'in',
  'Indonesia': 'id', 'Iran': 'ir', 'Iraq': 'iq', 'Ireland': 'ie',
  'Isle of Man': 'im', 'Israel': 'il', 'Italy': 'it', 'Ivory Coast': 'ci',
  'Jamaica': 'jm', 'Japan': 'jp', 'Jersey': 'je', 'Jordan': 'jo',
  'Kazakhstan': 'kz', 'Kenya': 'ke', 'Kosovo': 'xk', 'Kuwait': 'kw',
  'Kyrgyzstan': 'kg', 'Laos': 'la', 'Latvia': 'lv', 'Lebanon': 'lb',
  'Liberia': 'lr', 'Libya': 'ly', 'Liechtenstein': 'li', 'Lithuania': 'lt',
  'Luxembourg': 'lu', 'Macao': 'mo', 'Macedonia': 'mk', 'Madagascar': 'mg',
  'Malawi': 'mw', 'Malaysia': 'my', 'Maldives': 'mv', 'Mali': 'ml', 'Malta': 'mt',
  'Martinique': 'mq', 'Mauritania': 'mr', 'Mauritius': 'mu', 'Mayotte': 'yt',
  'Mexico': 'mx', 'Moldova': 'md', 'Monaco': 'mc', 'Mongolia': 'mn',
  'Montenegro': 'me', 'Morocco': 'ma', 'Mozambique': 'mz', 'Myanmar': 'mm',
  'Namibia': 'na', 'Nepal': 'np', 'Netherlands': 'nl', 'Netherlands Antilles': 'nl',
  'New Caledonia': 'nc', 'New Zealand': 'nz', 'Nicaragua': 'ni', 'Niger': 'ne',
  'Nigeria': 'ng', 'North Korea': 'kp', 'Norway': 'no', 'Oman': 'om',
  'Pakistan': 'pk', 'Palestine': 'ps', 'Panama': 'pa', 'Papua New Guinea': 'pg',
  'Paraguay': 'py', 'Peru': 'pe', 'Philippines': 'ph', 'Poland': 'pl',
  'Portugal': 'pt', 'Puerto Rico': 'pr', 'Reunion': 're', 'Romania': 'ro',
  'Rwanda': 'rw', 'Saint Kitts and Nevis': 'kn', 'Saint Lucia': 'lc',
  'Saint Vincent and the Grenadines': 'vc', 'Samoa': 'ws', 'San Marino': 'sm',
  'Sao Tome and Principe': 'st', 'Saudi Arabia': 'sa', 'Senegal': 'sn',
  'Serbia': 'rs', 'Seychelles': 'sc', 'Sierra Leone': 'sl', 'Singapore': 'sg',
  'Sint Maarten': 'sx', 'Slovakia': 'sk', 'Slovenia': 'si', 'Solomon Islands': 'sb',
  'South Africa': 'za', 'South Korea': 'kr', 'South Sudan': 'ss', 'Spain': 'es',
  'Sri Lanka': 'lk', 'Sudan': 'sd', 'Suriname': 'sr', 'Swaziland': 'sz',
  'Sweden': 'se', 'Switzerland': 'ch', 'Syria': 'sy', 'Taiwan': 'tw',
  'Tajikistan': 'tj', 'Tanzania': 'tz', 'Thailand': 'th', 'Togo': 'tg',
  'Tonga': 'to', 'Trinidad and Tobago': 'tt', 'Tunisia': 'tn', 'Turkey': 'tr',
  'Turkmenistan': 'tm', 'Turks and Caicos Islands': 'tc', 'UAE': 'ae',
  'Uganda': 'ug', 'Ukraine': 'ua', 'United Kingdom': 'gb', 'Uruguay': 'uy',
  'USA': 'us', 'Uzbekistan': 'uz', 'Vanuatu': 'vu', 'Venezuela': 've',
  'Vietnam': 'vn', 'Virgin Islands, U.S.': 'vi', 'Yemen': 'ye', 'Zambia': 'zm',
  'Zimbabwe': 'zw',
};

const CUSTOM_FLAG_SVG: Record<string, string> = {
  'USSR': 'assets/flags/ussr.svg',
  'DDR': 'assets/flags/ddr.svg',
  'Yugoslavia': 'assets/flags/yugoslavia.svg',
  'Russian Federation': 'assets/flags/lgbt.svg',
  'Belarus': 'assets/flags/belarus-bchb.svg',
};

@Component({
  selector: 'app-country-flag',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span *ngIf="flagCode" class="fi fi-{{ flagCode }} country-flag"></span>
    <img *ngIf="customSvg" [src]="customSvg" class="country-flag country-flag--custom" alt="" />
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
    }
    .country-flag {
      display: inline-block;
      width: 1.33em;
      line-height: 1em;
      vertical-align: middle;
    }
    .country-flag--custom {
      height: 0.85em;
      width: auto;
      border-radius: 1px;
    }
  `],
})
export class CountryFlagComponent {
  @Input() set country(value: string) {
    this._country = value;
    this.resolve();
  }

  flagCode = '';
  customSvg = '';

  private _country = '';

  private resolve(): void {
    const custom = CUSTOM_FLAG_SVG[this._country];
    if (custom) {
      this.flagCode = '';
      this.customSvg = custom;
      return;
    }
    const alpha2 = COUNTRY_TO_ALPHA2[this._country];
    if (alpha2) {
      this.flagCode = alpha2;
      this.customSvg = '';
      return;
    }
    this.flagCode = '';
    this.customSvg = '';
  }
}
