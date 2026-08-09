/*
 * Western constellation line coordinates adapted from d3-celestial 0.7.35.
 *
 * Copyright (c) 2015, Olaf Frohn
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software
 *    without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 * Coordinates are J2000 equatorial longitude/right ascension and declination.
 * The IAU defines constellation boundaries, not an official stick figure. These
 * are the familiar Western line figures plotted at real stellar coordinates.
 */

export type ZodiacSign =
  | "aries"
  | "taurus"
  | "gemini"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "scorpio"
  | "sagittarius"
  | "capricorn"
  | "aquarius"
  | "pisces";

export type ZodiacPoint = {
  x: number;
  y: number;
  longitude: number;
  latitude: number;
  magnitude: number;
};

export type ZodiacShape = {
  label: string;
  iauCode: string;
  centreLongitude: number;
  centreLatitude: number;
  points: ZodiacPoint[];
  segments: Array<[number, number]>;
};

type RawPoint = readonly [
  longitude: number,
  latitude: number,
  magnitude: number,
];

type RawShape = {
  readonly label: string;
  readonly iauCode: string;
  readonly lines: readonly (readonly RawPoint[])[];
};

const RAW_ZODIAC_LINES = {
  "aries": {
    "label": "Aries",
    "iauCode": "Ari",
    "lines": [
      [
        [
          42.496,
          27.2605,
          3.61
        ],
        [
          31.7934,
          23.4624,
          2.01
        ],
        [
          28.66,
          20.808,
          2.64
        ],
        [
          28.3826,
          19.2939,
          3.88
        ]
      ]
    ]
  },
  "taurus": {
    "label": "Taurus",
    "iauCode": "Tau",
    "lines": [
      [
        [
          84.4112,
          21.1425,
          2.97
        ],
        [
          68.9802,
          16.5093,
          0.87
        ],
        [
          67.1656,
          15.8709,
          3.4
        ],
        [
          64.9483,
          15.6276,
          3.65
        ],
        [
          65.7337,
          17.5425,
          3.77
        ],
        [
          67.1542,
          19.1804,
          3.53
        ],
        [
          81.573,
          28.6075,
          1.65
        ]
      ],
      [
        [
          64.9483,
          15.6276,
          3.65
        ],
        [
          60.1701,
          12.4903,
          3.41
        ],
        [
          51.7923,
          9.7327,
          3.73
        ],
        [
          60.7891,
          5.9893,
          3.91
        ]
      ],
      [
        [
          51.7923,
          9.7327,
          3.73
        ],
        [
          51.2033,
          9.0289,
          3.61
        ],
        [
          54.2183,
          0.4017,
          4.29
        ]
      ]
    ]
  },
  "gemini": {
    "label": "Gemini",
    "iauCode": "Gem",
    "lines": [
      [
        [
          93.7194,
          22.5068,
          3.31
        ],
        [
          95.7401,
          22.5136,
          2.87
        ],
        [
          100.983,
          25.1311,
          3.06
        ],
        [
          107.7849,
          30.2452,
          4.41
        ],
        [
          113.6494,
          31.8883,
          1.58
        ],
        [
          116.329,
          28.0262,
          1.16
        ],
        [
          113.9806,
          26.8957,
          4.06
        ],
        [
          110.0307,
          21.9823,
          3.5
        ],
        [
          106.0272,
          20.5703,
          4.01
        ],
        [
          99.4279,
          16.3993,
          1.93
        ],
        [
          101.3224,
          12.8956,
          3.35
        ]
      ],
      [
        [
          110.0307,
          21.9823,
          3.5
        ],
        [
          109.5232,
          16.5404,
          3.58
        ]
      ]
    ]
  },
  "cancer": {
    "label": "Cancer",
    "iauCode": "Cnc",
    "lines": [
      [
        [
          134.6218,
          11.8577,
          4.26
        ],
        [
          131.1712,
          18.1543,
          3.94
        ],
        [
          130.8214,
          21.4685,
          4.66
        ],
        [
          131.6666,
          28.7651,
          5
        ]
      ],
      [
        [
          131.1712,
          18.1543,
          3.94
        ],
        [
          124.1288,
          9.1855,
          3.53
        ]
      ]
    ]
  },
  "leo": {
    "label": "Leo",
    "iauCode": "Leo",
    "lines": [
      [
        [
          152.093,
          11.9672,
          1.36
        ],
        [
          151.8331,
          16.7627,
          3.48
        ],
        [
          154.9931,
          19.8415,
          2.01
        ],
        [
          168.5271,
          20.5237,
          2.56
        ],
        [
          177.2649,
          14.5721,
          2.14
        ],
        [
          168.56,
          15.4296,
          3.33
        ],
        [
          152.093,
          11.9672,
          1.36
        ]
      ],
      [
        [
          154.9931,
          19.8415,
          2.01
        ],
        [
          154.1726,
          23.4173,
          3.43
        ],
        [
          148.1909,
          26.007,
          3.88
        ],
        [
          146.4628,
          23.7743,
          2.97
        ]
      ]
    ]
  },
  "virgo": {
    "label": "Virgo",
    "iauCode": "Vir",
    "lines": [
      [
        [
          176.4648,
          6.5294,
          4.04
        ],
        [
          177.6738,
          1.7647,
          3.59
        ],
        [
          -175.0235,
          -0.6668,
          3.89
        ],
        [
          -169.5848,
          -1.4494,
          2.74
        ],
        [
          -162.5125,
          -5.539,
          4.38
        ],
        [
          -158.7018,
          -11.1613,
          0.98
        ],
        [
          -145.9964,
          -6.0005,
          4.07
        ],
        [
          -139.2349,
          -5.6582,
          3.87
        ]
      ],
      [
        [
          -164.4558,
          10.9592,
          2.85
        ],
        [
          -166.0991,
          3.3975,
          3.39
        ],
        [
          -169.5848,
          -1.4494,
          2.74
        ]
      ],
      [
        [
          -162.5125,
          -5.539,
          4.38
        ],
        [
          -156.3267,
          -0.5958,
          3.38
        ],
        [
          -149.5884,
          1.5445,
          4.23
        ],
        [
          -138.4378,
          1.8929,
          3.73
        ]
      ]
    ]
  },
  "libra": {
    "label": "Libra",
    "iauCode": "Lib",
    "lines": [
      [
        [
          -133.9824,
          -25.282,
          3.25
        ],
        [
          -137.2804,
          -16.0418,
          2.75
        ],
        [
          -130.7483,
          -9.3829,
          2.61
        ],
        [
          -126.1184,
          -14.7895,
          3.91
        ],
        [
          -125.744,
          -28.1351,
          3.6
        ],
        [
          -125.336,
          -29.7778,
          3.66
        ]
      ],
      [
        [
          -137.2804,
          -16.0418,
          2.75
        ],
        [
          -126.1184,
          -14.7895,
          3.91
        ]
      ]
    ]
  },
  "scorpio": {
    "label": "Scorpius",
    "iauCode": "Sco",
    "lines": [
      [
        [
          -120.287,
          -26.1141,
          2.89
        ],
        [
          -119.9166,
          -22.6217,
          2.29
        ],
        [
          -118.6407,
          -19.8055,
          2.56
        ]
      ],
      [
        [
          -119.9166,
          -22.6217,
          2.29
        ],
        [
          -114.7028,
          -25.5928,
          2.9
        ],
        [
          -112.6481,
          -26.432,
          1.06
        ],
        [
          -111.0294,
          -28.216,
          2.82
        ],
        [
          -107.4591,
          -34.2932,
          2.29
        ],
        [
          -107.0324,
          -38.0474,
          3
        ],
        [
          -106.3541,
          -42.3613,
          3.62
        ],
        [
          -101.9617,
          -43.2392,
          3.32
        ],
        [
          -95.6703,
          -42.9978,
          1.86
        ],
        [
          -93.1038,
          -40.127,
          2.99
        ],
        [
          -94.378,
          -39.03,
          2.39
        ],
        [
          -96.5978,
          -37.1038,
          1.62
        ]
      ]
    ]
  },
  "sagittarius": {
    "label": "Sagittarius",
    "iauCode": "Sgr",
    "lines": [
      [
        [
          -85.5932,
          -36.7617,
          3.1
        ],
        [
          -83.957,
          -34.3846,
          1.79
        ],
        [
          -84.7515,
          -29.8281,
          2.72
        ],
        [
          -83.0073,
          -25.4217,
          2.82
        ],
        [
          -86.5591,
          -21.0588,
          3.84
        ]
      ],
      [
        [
          -69.3404,
          -44.459,
          3.96
        ],
        [
          -69.0284,
          -40.6159,
          3.96
        ],
        [
          -74.347,
          -29.8801,
          2.6
        ],
        [
          -78.5859,
          -26.9908,
          3.17
        ],
        [
          -83.0073,
          -25.4217,
          2.82
        ]
      ],
      [
        [
          -61.1846,
          -41.8683,
          4.12
        ],
        [
          -60.0659,
          -35.2763,
          4.37
        ],
        [
          -61.0402,
          -26.2995,
          4.7
        ],
        [
          -65.8232,
          -24.8836,
          4.59
        ],
        [
          -68.6813,
          -24.5086,
          5.02
        ],
        [
          -71.1149,
          -25.2567,
          4.86
        ],
        [
          -76.1836,
          -26.2967,
          2.05
        ],
        [
          -78.5859,
          -26.9908,
          3.17
        ],
        [
          -84.7515,
          -29.8281,
          2.72
        ],
        [
          -88.548,
          -30.4241,
          2.98
        ],
        [
          -83.957,
          -34.3846,
          1.79
        ],
        [
          -74.347,
          -29.8801,
          2.6
        ],
        [
          -73.265,
          -27.6704,
          3.32
        ],
        [
          -76.1836,
          -26.2967,
          2.05
        ],
        [
          -73.8292,
          -21.7415,
          3.76
        ],
        [
          -72.559,
          -21.0236,
          2.88
        ],
        [
          -70.5913,
          -18.9529,
          4.88
        ],
        [
          -69.5818,
          -17.8472,
          3.92
        ],
        [
          -69.5682,
          -15.955,
          4.52
        ]
      ],
      [
        [
          -73.8292,
          -21.7415,
          3.76
        ],
        [
          -75.5675,
          -21.1067,
          3.52
        ],
        [
          -76.4576,
          -22.7448,
          4.86
        ],
        [
          -76.1836,
          -26.2967,
          2.05
        ]
      ]
    ]
  },
  "capricorn": {
    "label": "Capricornus",
    "iauCode": "Cap",
    "lines": [
      [
        [
          -55.588,
          -12.5082,
          4.3
        ],
        [
          -54.7472,
          -14.7814,
          3.05
        ],
        [
          -52.7849,
          -17.8137,
          4.77
        ],
        [
          -48.4761,
          -25.2709,
          4.13
        ],
        [
          -47.0446,
          -26.9191,
          4.12
        ],
        [
          -38.3332,
          -22.4113,
          3.77
        ],
        [
          -33.2398,
          -16.1273,
          2.85
        ],
        [
          -34.9773,
          -16.6623,
          3.69
        ],
        [
          -39.4383,
          -16.8345,
          4.28
        ],
        [
          -43.5132,
          -17.2329,
          4.08
        ],
        [
          -55.588,
          -12.5082,
          4.3
        ]
      ]
    ]
  },
  "aquarius": {
    "label": "Aquarius",
    "iauCode": "Aqr",
    "lines": [
      [
        [
          -48.081,
          -9.4958,
          3.78
        ],
        [
          -46.8365,
          -8.9833,
          4.73
        ],
        [
          -37.1103,
          -5.5712,
          2.9
        ],
        [
          -28.554,
          -0.3199,
          2.95
        ],
        [
          -24.5859,
          -1.3873,
          3.86
        ],
        [
          -22.792,
          -0.02,
          3.65
        ],
        [
          -21.1609,
          -0.1175,
          4.04
        ],
        [
          -16.8464,
          -7.5796,
          3.73
        ],
        [
          -10.5241,
          -9.1825,
          4.41
        ],
        [
          -12.6383,
          -21.1724,
          3.68
        ]
      ],
      [
        [
          -37.1103,
          -5.5712,
          2.9
        ],
        [
          -28.3907,
          -13.8697,
          4.29
        ]
      ],
      [
        [
          -28.554,
          -0.3199,
          2.95
        ],
        [
          -25.7915,
          -7.7833,
          4.17
        ]
      ],
      [
        [
          -22.792,
          -0.02,
          3.65
        ],
        [
          -23.6807,
          1.3774,
          4.8
        ]
      ],
      [
        [
          -9.2574,
          -20.1006,
          3.96
        ],
        [
          -10.5241,
          -9.1825,
          4.41
        ],
        [
          -4.5591,
          -17.8165,
          4.82
        ]
      ]
    ]
  },
  "pisces": {
    "label": "Pisces",
    "iauCode": "Psc",
    "lines": [
      [
        [
          18.4373,
          24.5837,
          4.67
        ],
        [
          17.9152,
          30.0896,
          4.51
        ],
        [
          19.8666,
          27.2641,
          4.74
        ],
        [
          18.4373,
          24.5837,
          4.67
        ],
        [
          17.8634,
          21.0347,
          4.66
        ],
        [
          22.8709,
          15.3458,
          3.62
        ],
        [
          26.3485,
          9.1577,
          4.26
        ],
        [
          30.5118,
          2.7638,
          3.82
        ],
        [
          28.389,
          3.1875,
          4.61
        ],
        [
          25.3579,
          5.4876,
          4.45
        ],
        [
          22.5463,
          6.1438,
          4.84
        ],
        [
          18.4329,
          7.5754,
          5.21
        ],
        [
          15.7359,
          7.8901,
          4.27
        ],
        [
          12.1706,
          7.5851,
          4.44
        ],
        [
          -0.1721,
          6.8633,
          4.03
        ],
        [
          -5.0123,
          5.6263,
          4.13
        ],
        [
          -8.0079,
          6.379,
          4.27
        ],
        [
          -9.9142,
          5.3813,
          5.05
        ],
        [
          -10.7086,
          3.2823,
          3.7
        ],
        [
          -8.2669,
          1.2556,
          4.95
        ],
        [
          -4.4883,
          1.78,
          4.49
        ],
        [
          -3.402,
          3.4868,
          4.95
        ],
        [
          -5.0123,
          5.6263,
          4.13
        ]
      ],
      [
        [
          -10.7086,
          3.2823,
          3.7
        ],
        [
          -14.0308,
          3.82,
          4.48
        ]
      ]
    ]
  }
} as const satisfies Record<ZodiacSign, RawShape>;

function coordinateKey(point: RawPoint): string {
  return point[0].toFixed(4) + "," + point[1].toFixed(4);
}

function buildShape(raw: RawShape): ZodiacShape {
  const unique = new Map<string, RawPoint>();

  for (const line of raw.lines) {
    for (const point of line) {
      unique.set(coordinateKey(point), point);
    }
  }

  const celestialPoints = Array.from(unique.values());
  const celestialVector = celestialPoints.reduce(
    (vector, point) => {
      const longitude = (point[0] * Math.PI) / 180;
      const latitude = (point[1] * Math.PI) / 180;
      const cosLatitude = Math.cos(latitude);
      vector.x += cosLatitude * Math.cos(longitude);
      vector.y += cosLatitude * Math.sin(longitude);
      vector.z += Math.sin(latitude);
      return vector;
    },
    { x: 0, y: 0, z: 0 },
  );
  const centreLongitude =
    (Math.atan2(celestialVector.y, celestialVector.x) * 180) / Math.PI;
  const centreLatitude =
    (Math.atan2(
      celestialVector.z,
      Math.hypot(celestialVector.x, celestialVector.y),
    ) *
      180) /
    Math.PI;
  const centreLongitudeRadians = (centreLongitude * Math.PI) / 180;
  const centreLatitudeRadians = (centreLatitude * Math.PI) / 180;
  const sinCentreLatitude = Math.sin(centreLatitudeRadians);
  const cosCentreLatitude = Math.cos(centreLatitudeRadians);

  const localPoints = celestialPoints.map((point) => {
    const longitude = (point[0] * Math.PI) / 180;
    const latitude = (point[1] * Math.PI) / 180;
    const longitudeDelta = longitude - centreLongitudeRadians;
    const sinLatitude = Math.sin(latitude);
    const cosLatitude = Math.cos(latitude);
    const cosLongitudeDelta = Math.cos(longitudeDelta);
    const denominator = Math.max(
      0.01,
      sinCentreLatitude * sinLatitude +
        cosCentreLatitude * cosLatitude * cosLongitudeDelta,
    );

    return {
      longitude: point[0],
      latitude: point[1],
      magnitude: point[2],
      // Gnomonic projection: north is up and east is left, matching a
      // celestial chart viewed from inside Earth's sky sphere.
      localX: -(cosLatitude * Math.sin(longitudeDelta)) / denominator,
      localY:
        -(
          cosCentreLatitude * sinLatitude -
          sinCentreLatitude * cosLatitude * cosLongitudeDelta
        ) / denominator,
    };
  });

  const minX = Math.min(...localPoints.map((point) => point.localX));
  const maxX = Math.max(...localPoints.map((point) => point.localX));
  const minY = Math.min(...localPoints.map((point) => point.localY));
  const maxY = Math.max(...localPoints.map((point) => point.localY));
  const span = Math.max(0.0001, maxX - minX, maxY - minY);
  const scale = 72 / span;
  const localCentreX = (minX + maxX) / 2;
  const localCentreY = (minY + maxY) / 2;

  const points = localPoints.map((point) => ({
    x: 50 + (point.localX - localCentreX) * scale,
    y: 50 + (point.localY - localCentreY) * scale,
    longitude: point.longitude,
    latitude: point.latitude,
    magnitude: point.magnitude,
  }));

  const pointIndexes = new Map(
    celestialPoints.map((point, index) => [coordinateKey(point), index]),
  );
  const segmentKeys = new Set<string>();
  const segments: Array<[number, number]> = [];

  for (const line of raw.lines) {
    for (let index = 1; index < line.length; index += 1) {
      const from = pointIndexes.get(coordinateKey(line[index - 1]));
      const to = pointIndexes.get(coordinateKey(line[index]));

      if (from === undefined || to === undefined || from === to) continue;

      const key =
        from < to ? String(from) + ":" + String(to) : String(to) + ":" + String(from);

      if (!segmentKeys.has(key)) {
        segmentKeys.add(key);
        segments.push([from, to]);
      }
    }
  }

  return {
    label: raw.label,
    iauCode: raw.iauCode,
    centreLongitude,
    centreLatitude,
    points,
    segments,
  };
}

export const ZODIAC_SIGNS = Object.keys(
  RAW_ZODIAC_LINES,
) as ZodiacSign[];

export const ZODIAC_SHAPES = ZODIAC_SIGNS.reduce(
  (shapes, sign) => {
    shapes[sign] = buildShape(RAW_ZODIAC_LINES[sign]);
    return shapes;
  },
  {} as Record<ZodiacSign, ZodiacShape>,
);
