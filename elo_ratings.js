const ELORATINGS_URL = 'https://www.eloratings.net/World.tsv';

async function fetchEloRatings() {
  const res = await fetch(ELORATINGS_URL);
  if (!res.ok) throw new Error(`eloRatings HTTP ${res.status}`);
  const tsv = await res.text();
  const lines = tsv.trim().split('\n');
  const teams = [];
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 4) continue;
    teams.push({
      rank: parseInt(parts[0], 10),
      code: parts[2],
      elo: parseFloat(parts[3]),
      name: null
    });
  }
  return teams;
}

const CODE_TO_NAME = {
  'ES': 'Spain', 'AR': 'Argentina', 'FR': 'France', 'EN': 'England',
  'PT': 'Portugal', 'CO': 'Colombia', 'BR': 'Brazil', 'NL': 'Netherlands',
  'EC': 'Ecuador', 'DE': 'Germany', 'UY': 'Uruguay', 'IT': 'Italy',
  'IR': 'Iran', 'HR': 'Croatia', 'MA': 'Morocco', 'HU': 'Hungary',
  'DK': 'Denmark', 'JP': 'Japan', 'CH': 'Switzerland', 'UA': 'Ukraine',
  'SE': 'Sweden', 'AT': 'Austria', 'KR': 'South Korea', 'US': 'USA',
  'BE': 'Belgium', 'MX': 'Mexico', 'NO': 'Norway', 'RU': 'Russia',
  'PL': 'Poland', 'SN': 'Senegal', 'RS': 'Serbia', 'CM': 'Cameroon',
  'CZ': 'Czech Republic', 'RO': 'Romania', 'GR': 'Greece', 'NG': 'Nigeria',
  'SK': 'Slovakia', 'IE': 'Republic of Ireland', 'TN': 'Tunisia',
  'PE': 'Peru', 'GH': 'Ghana', 'CI': "Côte d'Ivoire", 'CL': 'Chile',
  'CA': 'Canada', 'BF': 'Burkina Faso', 'AU': 'Australia', 'ZA': 'South Africa',
  'DZ': 'Algeria', 'EG': 'Egypt', 'GB': 'Great Britain', 'VE': 'Venezuela',
  'ML': 'Mali', 'NE': 'Niger', 'CD': 'DR Congo', 'AO': 'Angola',
  'GN': 'Guinea', 'CG': 'Congo', 'GA': 'Gabon', 'ZM': 'Zambia',
  'MA': 'Morocco', 'SL': 'Sierra Leone', 'BI': 'Burundi', 'TG': 'Togo',
  'BW': 'Botswana', 'LS': 'Lesotho', 'NA': 'Namibia', 'ZW': 'Zimbabwe',
  'MZ': 'Mozambique', 'SZ': 'Eswatini', 'KM': 'Comoros', 'SC': 'Seychelles',
  'MU': 'Mauritius', 'CV': 'Cape Verde', 'ST': 'São Tomé and Príncipe',
  'GQ': 'Equatorial Guinea', 'GW': 'Guinea-Bissau', 'LR': 'Liberia',
  'MR': 'Mauritania', 'SD': 'Sudan', 'SS': 'South Sudan', 'DJ': 'Djibouti',
  'ER': 'Eritrea', 'ET': 'Ethiopia', 'KE': 'Kenya', 'TZ': 'Tanzania',
  'UG': 'Uganda', 'RW': 'Rwanda', 'SO': 'Somalia', 'MG': 'Madagascar',
  'MW': 'Malawi', 'FK': 'Falkland Islands', 'PY': 'Paraguay',
  'BO': 'Bolivia', 'GY': 'Guyana', 'SR': 'Suriname', 'TT': 'Trinidad and Tobago',
  'JM': 'Jamaica', 'HT': 'Haiti', 'BS': 'Bahamas', 'BB': 'Barbados',
  'GD': 'Grenada', 'VC': 'Saint Vincent', 'LC': 'Saint Lucia',
  'DM': 'Dominica', 'AG': 'Antigua', 'KN': 'Saint Kitts',
  'CR': 'Costa Rica', 'PA': 'Panama', 'HN': 'Honduras', 'SV': 'El Salvador',
  'GT': 'Guatemala', 'BZ': 'Belize', 'NI': 'Nicaragua',
  'SA': 'Saudi Arabia', 'QA': 'Qatar', 'AE': 'United Arab Emirates',
  'OM': 'Oman', 'BH': 'Bahrain', 'KW': 'Kuwait', 'IQ': 'Iraq',
  'SY': 'Syria', 'JO': 'Jordan', 'LB': 'Lebanon', 'YE': 'Yemen',
  'KP': 'North Korea', 'CN': 'China', 'TW': 'Chinese Taipei',
  'HK': 'Hong Kong', 'MO': 'Macau', 'MN': 'Mongolia', 'AF': 'Afghanistan',
  'NP': 'Nepal', 'BT': 'Bhutan', 'BD': 'Bangladesh', 'MV': 'Maldives',
  'LK': 'Sri Lanka', 'PK': 'Pakistan', 'IN': 'India', 'IR': 'Iran',
  'UZ': 'Uzbekistan', 'TM': 'Turkmenistan', 'KG': 'Kyrgyzstan',
  'TJ': 'Tajikistan', 'KZ': 'Kazakhstan', 'AZ': 'Azerbaijan',
  'GE': 'Georgia', 'AM': 'Armenia', 'TR': 'Turkey', 'IL': 'Israel',
  'PS': 'Palestine', 'CY': 'Cyprus', 'LB': 'Lebanon', 'JO': 'Jordan',
  'SG': 'Singapore', 'MY': 'Malaysia', 'ID': 'Indonesia', 'PH': 'Philippines',
  'TH': 'Thailand', 'VN': 'Vietnam', 'MM': 'Myanmar', 'LA': 'Laos',
  'KH': 'Cambodia', 'BN': 'Brunei', 'TL': 'Timor-Leste',
  'NZ': 'New Zealand', 'FJ': 'Fiji', 'PG': 'Papua New Guinea',
  'SB': 'Solomon Islands', 'VU': 'Vanuatu', 'NC': 'New Caledonia',
  'TA': 'Tahiti', 'WS': 'Samoa', 'TO': 'Tonga', 'CK': 'Cook Islands',
  'AS': 'American Samoa', 'GU': 'Guam', 'WF': 'Wallis and Futuna',
  'MH': 'Marshall Islands', 'FM': 'Micronesia', 'PW': 'Palau',
  'NR': 'Nauru', 'KI': 'Kiribati', 'TV': 'Tuvalu', 'SB': 'Solomon Islands',
  'BA': 'Bosnia and Herzegovina', 'SI': 'Slovenia', 'MK': 'North Macedonia',
  'AL': 'Albania', 'ME': 'Montenegro', 'XK': 'Kosovo', 'LT': 'Lithuania',
  'LV': 'Latvia', 'EE': 'Estonia', 'BY': 'Belarus', 'MD': 'Moldova',
  'IS': 'Iceland', 'FO': 'Faroe Islands', 'FI': 'Finland', 'LU': 'Luxembourg',
  'MT': 'Malta', 'AD': 'Andorra', 'LI': 'Liechtenstein', 'MC': 'Monaco',
  'GI': 'Gibraltar', 'SM': 'San Marino', 'VA': 'Vatican City',
  'BQ': 'Bonaire', 'CW': 'Curaçao', 'AW': 'Aruba', 'SX': 'Sint Maarten',
  'MF': 'Saint Martin', 'BL': 'Saint Barthélemy', 'PM': 'Saint Pierre and Miquelon',
  'GL': 'Greenland', 'GG': 'Guernsey', 'JE': 'Jersey', 'IM': 'Isle of Man',
  'AI': 'Anguilla', 'MS': 'Montserrat', 'KY': 'Cayman Islands',
  'TC': 'Turks and Caicos Islands', 'VG': 'British Virgin Islands',
  'VI': 'US Virgin Islands', 'PR': 'Puerto Rico', 'CU': 'Cuba',
  'DO': 'Dominican Republic', 'GP': 'Guadeloupe', 'MQ': 'Martinique',
  'GF': 'French Guiana', 'RE': 'Réunion', 'YT': 'Mayotte',
  'NC': 'New Caledonia', 'PF': 'French Polynesia',
};

// Map country codes to API-Football team IDs (from fixtures we found)
const CODE_TO_API_ID = {
  'MX': 30,   // Mexico
  'ZA': 3948, // South Africa
  'KR': 15,   // South Korea
  'CZ': 56,   // Czech Republic
  'CA': 44,   // Canada
  'BA': 82,   // Bosnia and Herzegovina
};

function getCountryName(code) {
  return CODE_TO_NAME[code] || code;
}

module.exports = { fetchEloRatings, CODE_TO_NAME, CODE_TO_API_ID, getCountryName };