#version 150

in vec3 Position;
in vec4 Color;
in vec2 UV0;
in ivec2 UV2;

uniform sampler2D Sampler1;   // trample field (R = amount, GB = push direction, A = cut height / 2)
uniform sampler2D Sampler2;   // lightmap

uniform mat4 ModelViewMat;
uniform mat4 ProjMat;
uniform int FogShape;
uniform vec3 ChunkOrigin;     // chunk origin in world space, wrapped to 4096 (exact for wind / trample lookup)
uniform vec3 ChunkRel;        // chunk origin minus camera position
uniform vec4 WindParams;      // x = time (s), y = wind strength, z = trample on/off, w = wind speed
uniform vec4 TuftAtlas;       // where the tuft sprite sits in the block atlas: minU, minV, width, height
uniform vec4 StyleParams;     // x = wetness (0..1, after rain), y = rest lean, zw = look direction
uniform vec4 FadeParams;      // x,y,z,w = distances where the tufts of the ranks that LITE / MID / MIDFAR / FAR drop are gone
uniform vec4 LodParams;       // x = where the rank-0 tufts are gone (the imposter takes over), y,z = far-edge fade distances, w = where the wind detail fades (52)
uniform vec4 WfWind;          // Windfall link: xy = wind direction, z = on / off
uniform vec4 WfWave0;         // Windfall gusts (3 waves, 2 vec4 each): origin xz, direction xz
uniform vec4 WfWave1;         //   front position, half width, centre across, strength
uniform vec4 WfWave2;
uniform vec4 WfWave3;
uniform vec4 WfWave4;
uniform vec4 WfWave5;

out float vertexDistance;
out vec4 vertexColor;
out vec2 texUV;               // tuft texture coordinate (x < 0 = this vertex has no texture)

// @@TUFT_BEGIN@@
const vec2 TUFT_SPRITE = vec2(1024.0, 1008.0);
const float TUFT_SMAX = 1.45;   // the texture holds shade / TUFT_SMAX: the textured tufts are multiplied by this again
const vec4 TUFT_PX[280] = vec4[280](
    vec4(0.0, 0.0, 0.0, 0.0),
    vec4(870.0, 290.0, 24.0, 16.0),
    vec4(678.0, 397.0, 24.0, 5.0),
    vec4(390.0, 397.0, 24.0, 6.0),
    vec4(102.0, 397.0, 24.0, 7.0),
    vec4(438.0, 375.0, 24.0, 8.0),
    vec4(150.0, 375.0, 24.0, 9.0),
    vec4(870.0, 350.0, 24.0, 10.0),
    vec4(582.0, 350.0, 24.0, 11.0),
    vec4(294.0, 350.0, 24.0, 12.0),
    vec4(6.0, 350.0, 24.0, 13.0),
    vec4(726.0, 322.0, 24.0, 14.0),
    vec4(438.0, 322.0, 24.0, 15.0),
    vec4(654.0, 150.0, 48.0, 32.0),
    vec4(726.0, 375.0, 12.0, 8.0),
    vec4(966.0, 397.0, 6.0, 4.0),
    vec4(750.0, 375.0, 12.0, 8.0),
    vec4(6.0, 6.0, 96.0, 64.0),
    vec4(6.0, 290.0, 96.0, 20.0),
    vec4(66.0, 246.0, 96.0, 28.0),
    vec4(762.0, 82.0, 96.0, 40.0),
    vec4(870.0, 6.0, 96.0, 56.0),
    vec4(714.0, 150.0, 48.0, 32.0),
    vec4(774.0, 150.0, 48.0, 32.0),
    vec4(906.0, 290.0, 24.0, 16.0),
    vec4(942.0, 290.0, 24.0, 16.0),
    vec4(714.0, 397.0, 24.0, 5.0),
    vec4(426.0, 397.0, 24.0, 6.0),
    vec4(138.0, 397.0, 24.0, 7.0),
    vec4(474.0, 375.0, 24.0, 8.0),
    vec4(186.0, 375.0, 24.0, 9.0),
    vec4(906.0, 350.0, 24.0, 10.0),
    vec4(618.0, 350.0, 24.0, 11.0),
    vec4(330.0, 350.0, 24.0, 12.0),
    vec4(42.0, 350.0, 24.0, 13.0),
    vec4(762.0, 322.0, 24.0, 14.0),
    vec4(474.0, 322.0, 24.0, 15.0),
    vec4(834.0, 150.0, 48.0, 32.0),
    vec4(774.0, 375.0, 12.0, 8.0),
    vec4(984.0, 397.0, 6.0, 4.0),
    vec4(798.0, 375.0, 12.0, 8.0),
    vec4(114.0, 6.0, 96.0, 64.0),
    vec4(114.0, 290.0, 96.0, 20.0),
    vec4(174.0, 246.0, 96.0, 28.0),
    vec4(870.0, 82.0, 96.0, 40.0),
    vec4(6.0, 82.0, 96.0, 56.0),
    vec4(894.0, 150.0, 48.0, 32.0),
    vec4(954.0, 150.0, 48.0, 32.0),
    vec4(978.0, 290.0, 24.0, 16.0),
    vec4(6.0, 322.0, 24.0, 16.0),
    vec4(750.0, 397.0, 24.0, 5.0),
    vec4(462.0, 397.0, 24.0, 6.0),
    vec4(174.0, 397.0, 24.0, 7.0),
    vec4(510.0, 375.0, 24.0, 8.0),
    vec4(222.0, 375.0, 24.0, 9.0),
    vec4(942.0, 350.0, 24.0, 10.0),
    vec4(654.0, 350.0, 24.0, 11.0),
    vec4(366.0, 350.0, 24.0, 12.0),
    vec4(78.0, 350.0, 24.0, 13.0),
    vec4(798.0, 322.0, 24.0, 14.0),
    vec4(510.0, 322.0, 24.0, 15.0),
    vec4(6.0, 202.0, 48.0, 32.0),
    vec4(822.0, 375.0, 12.0, 8.0),
    vec4(1002.0, 397.0, 6.0, 4.0),
    vec4(846.0, 375.0, 12.0, 8.0),
    vec4(222.0, 6.0, 96.0, 64.0),
    vec4(222.0, 290.0, 96.0, 20.0),
    vec4(282.0, 246.0, 96.0, 28.0),
    vec4(6.0, 150.0, 96.0, 40.0),
    vec4(114.0, 82.0, 96.0, 56.0),
    vec4(66.0, 202.0, 48.0, 32.0),
    vec4(126.0, 202.0, 48.0, 32.0),
    vec4(42.0, 322.0, 24.0, 16.0),
    vec4(78.0, 322.0, 24.0, 16.0),
    vec4(786.0, 397.0, 24.0, 5.0),
    vec4(498.0, 397.0, 24.0, 6.0),
    vec4(210.0, 397.0, 24.0, 7.0),
    vec4(546.0, 375.0, 24.0, 8.0),
    vec4(258.0, 375.0, 24.0, 9.0),
    vec4(978.0, 350.0, 24.0, 10.0),
    vec4(690.0, 350.0, 24.0, 11.0),
    vec4(402.0, 350.0, 24.0, 12.0),
    vec4(114.0, 350.0, 24.0, 13.0),
    vec4(834.0, 322.0, 24.0, 14.0),
    vec4(546.0, 322.0, 24.0, 15.0),
    vec4(186.0, 202.0, 48.0, 32.0),
    vec4(870.0, 375.0, 12.0, 8.0),
    vec4(6.0, 417.0, 6.0, 4.0),
    vec4(894.0, 375.0, 12.0, 8.0),
    vec4(330.0, 6.0, 96.0, 64.0),
    vec4(330.0, 290.0, 96.0, 20.0),
    vec4(390.0, 246.0, 96.0, 28.0),
    vec4(114.0, 150.0, 96.0, 40.0),
    vec4(222.0, 82.0, 96.0, 56.0),
    vec4(246.0, 202.0, 48.0, 32.0),
    vec4(306.0, 202.0, 48.0, 32.0),
    vec4(114.0, 322.0, 24.0, 16.0),
    vec4(150.0, 322.0, 24.0, 16.0),
    vec4(822.0, 397.0, 24.0, 5.0),
    vec4(534.0, 397.0, 24.0, 6.0),
    vec4(246.0, 397.0, 24.0, 7.0),
    vec4(582.0, 375.0, 24.0, 8.0),
    vec4(294.0, 375.0, 24.0, 9.0),
    vec4(6.0, 375.0, 24.0, 10.0),
    vec4(726.0, 350.0, 24.0, 11.0),
    vec4(438.0, 350.0, 24.0, 12.0),
    vec4(150.0, 350.0, 24.0, 13.0),
    vec4(870.0, 322.0, 24.0, 14.0),
    vec4(582.0, 322.0, 24.0, 15.0),
    vec4(366.0, 202.0, 48.0, 32.0),
    vec4(918.0, 375.0, 12.0, 8.0),
    vec4(24.0, 417.0, 6.0, 4.0),
    vec4(942.0, 375.0, 12.0, 8.0),
    vec4(438.0, 6.0, 96.0, 64.0),
    vec4(438.0, 290.0, 96.0, 20.0),
    vec4(498.0, 246.0, 96.0, 28.0),
    vec4(222.0, 150.0, 96.0, 40.0),
    vec4(330.0, 82.0, 96.0, 56.0),
    vec4(426.0, 202.0, 48.0, 32.0),
    vec4(486.0, 202.0, 48.0, 32.0),
    vec4(186.0, 322.0, 24.0, 16.0),
    vec4(222.0, 322.0, 24.0, 16.0),
    vec4(858.0, 397.0, 24.0, 5.0),
    vec4(570.0, 397.0, 24.0, 6.0),
    vec4(282.0, 397.0, 24.0, 7.0),
    vec4(618.0, 375.0, 24.0, 8.0),
    vec4(330.0, 375.0, 24.0, 9.0),
    vec4(42.0, 375.0, 24.0, 10.0),
    vec4(762.0, 350.0, 24.0, 11.0),
    vec4(474.0, 350.0, 24.0, 12.0),
    vec4(186.0, 350.0, 24.0, 13.0),
    vec4(906.0, 322.0, 24.0, 14.0),
    vec4(618.0, 322.0, 24.0, 15.0),
    vec4(546.0, 202.0, 48.0, 32.0),
    vec4(966.0, 375.0, 12.0, 8.0),
    vec4(42.0, 417.0, 6.0, 4.0),
    vec4(990.0, 375.0, 12.0, 8.0),
    vec4(546.0, 6.0, 96.0, 64.0),
    vec4(546.0, 290.0, 96.0, 20.0),
    vec4(606.0, 246.0, 96.0, 28.0),
    vec4(330.0, 150.0, 96.0, 40.0),
    vec4(438.0, 82.0, 96.0, 56.0),
    vec4(606.0, 202.0, 48.0, 32.0),
    vec4(666.0, 202.0, 48.0, 32.0),
    vec4(258.0, 322.0, 24.0, 16.0),
    vec4(294.0, 322.0, 24.0, 16.0),
    vec4(894.0, 397.0, 24.0, 5.0),
    vec4(606.0, 397.0, 24.0, 6.0),
    vec4(318.0, 397.0, 24.0, 7.0),
    vec4(654.0, 375.0, 24.0, 8.0),
    vec4(366.0, 375.0, 24.0, 9.0),
    vec4(78.0, 375.0, 24.0, 10.0),
    vec4(798.0, 350.0, 24.0, 11.0),
    vec4(510.0, 350.0, 24.0, 12.0),
    vec4(222.0, 350.0, 24.0, 13.0),
    vec4(942.0, 322.0, 24.0, 14.0),
    vec4(654.0, 322.0, 24.0, 15.0),
    vec4(726.0, 202.0, 48.0, 32.0),
    vec4(6.0, 397.0, 12.0, 8.0),
    vec4(60.0, 417.0, 6.0, 4.0),
    vec4(30.0, 397.0, 12.0, 8.0),
    vec4(654.0, 6.0, 96.0, 64.0),
    vec4(654.0, 290.0, 96.0, 20.0),
    vec4(714.0, 246.0, 96.0, 28.0),
    vec4(438.0, 150.0, 96.0, 40.0),
    vec4(546.0, 82.0, 96.0, 56.0),
    vec4(786.0, 202.0, 48.0, 32.0),
    vec4(846.0, 202.0, 48.0, 32.0),
    vec4(330.0, 322.0, 24.0, 16.0),
    vec4(366.0, 322.0, 24.0, 16.0),
    vec4(930.0, 397.0, 24.0, 5.0),
    vec4(642.0, 397.0, 24.0, 6.0),
    vec4(354.0, 397.0, 24.0, 7.0),
    vec4(690.0, 375.0, 24.0, 8.0),
    vec4(402.0, 375.0, 24.0, 9.0),
    vec4(114.0, 375.0, 24.0, 10.0),
    vec4(834.0, 350.0, 24.0, 11.0),
    vec4(546.0, 350.0, 24.0, 12.0),
    vec4(258.0, 350.0, 24.0, 13.0),
    vec4(978.0, 322.0, 24.0, 14.0),
    vec4(690.0, 322.0, 24.0, 15.0),
    vec4(906.0, 202.0, 48.0, 32.0),
    vec4(54.0, 397.0, 12.0, 8.0),
    vec4(78.0, 417.0, 6.0, 4.0),
    vec4(78.0, 397.0, 12.0, 8.0),
    vec4(762.0, 6.0, 96.0, 64.0),
    vec4(762.0, 290.0, 96.0, 20.0),
    vec4(822.0, 246.0, 96.0, 28.0),
    vec4(546.0, 150.0, 96.0, 40.0),
    vec4(654.0, 82.0, 96.0, 56.0),
    vec4(966.0, 202.0, 48.0, 32.0),
    vec4(6.0, 246.0, 48.0, 32.0),
    vec4(402.0, 322.0, 24.0, 16.0),
    vec4(210.0, 889.0, 9.0, 10.0),
    vec4(225.0, 889.0, 9.0, 10.0),
    vec4(240.0, 889.0, 9.0, 10.0),
    vec4(255.0, 889.0, 9.0, 10.0),
    vec4(52.0, 775.0, 48.0, 56.0),
    vec4(106.0, 775.0, 48.0, 56.0),
    vec4(160.0, 775.0, 48.0, 56.0),
    vec4(214.0, 775.0, 48.0, 56.0),
    vec4(268.0, 775.0, 24.0, 48.0),
    vec4(292.0, 775.0, 24.0, 48.0),
    vec4(6.0, 427.0, 120.0, 240.0),
    vec4(126.0, 427.0, 120.0, 240.0),
    vec4(510.0, 889.0, 24.0, 3.0),
    vec4(540.0, 889.0, 24.0, 3.0),
    vec4(570.0, 889.0, 24.0, 3.0),
    vec4(600.0, 889.0, 24.0, 3.0),
    vec4(390.0, 889.0, 24.0, 4.0),
    vec4(420.0, 889.0, 24.0, 4.0),
    vec4(450.0, 889.0, 24.0, 4.0),
    vec4(480.0, 889.0, 24.0, 4.0),
    vec4(270.0, 889.0, 24.0, 5.0),
    vec4(300.0, 889.0, 24.0, 5.0),
    vec4(330.0, 889.0, 24.0, 5.0),
    vec4(360.0, 889.0, 24.0, 5.0),
    vec4(720.0, 863.0, 96.0, 12.0),
    vec4(822.0, 863.0, 96.0, 12.0),
    vec4(6.0, 889.0, 96.0, 12.0),
    vec4(108.0, 889.0, 96.0, 12.0),
    vec4(312.0, 863.0, 96.0, 16.0),
    vec4(414.0, 863.0, 96.0, 16.0),
    vec4(516.0, 863.0, 96.0, 16.0),
    vec4(618.0, 863.0, 96.0, 16.0),
    vec4(838.0, 775.0, 96.0, 20.0),
    vec4(6.0, 863.0, 96.0, 20.0),
    vec4(108.0, 863.0, 96.0, 20.0),
    vec4(210.0, 863.0, 96.0, 20.0),
    vec4(388.0, 775.0, 24.0, 24.0),
    vec4(418.0, 775.0, 24.0, 24.0),
    vec4(448.0, 775.0, 24.0, 24.0),
    vec4(478.0, 775.0, 24.0, 24.0),
    vec4(508.0, 775.0, 24.0, 24.0),
    vec4(538.0, 775.0, 24.0, 24.0),
    vec4(568.0, 775.0, 24.0, 24.0),
    vec4(598.0, 775.0, 24.0, 24.0),
    vec4(628.0, 775.0, 24.0, 24.0),
    vec4(658.0, 775.0, 24.0, 24.0),
    vec4(688.0, 775.0, 24.0, 24.0),
    vec4(718.0, 775.0, 24.0, 24.0),
    vec4(748.0, 775.0, 24.0, 24.0),
    vec4(778.0, 775.0, 24.0, 24.0),
    vec4(808.0, 775.0, 24.0, 24.0),
    vec4(252.0, 427.0, 96.0, 96.0),
    vec4(354.0, 427.0, 96.0, 96.0),
    vec4(456.0, 427.0, 96.0, 96.0),
    vec4(558.0, 427.0, 96.0, 96.0),
    vec4(660.0, 427.0, 96.0, 96.0),
    vec4(762.0, 427.0, 96.0, 96.0),
    vec4(864.0, 427.0, 96.0, 96.0),
    vec4(6.0, 673.0, 96.0, 96.0),
    vec4(108.0, 673.0, 96.0, 96.0),
    vec4(210.0, 673.0, 96.0, 96.0),
    vec4(312.0, 673.0, 96.0, 96.0),
    vec4(414.0, 673.0, 96.0, 96.0),
    vec4(516.0, 673.0, 96.0, 96.0),
    vec4(618.0, 673.0, 96.0, 96.0),
    vec4(720.0, 673.0, 96.0, 96.0),
    vec4(322.0, 775.0, 17.0, 38.0),
    vec4(364.0, 775.0, 18.0, 33.0),
    vec4(345.0, 775.0, 13.0, 36.0),
    vec4(822.0, 673.0, 40.0, 83.0),
    vec4(868.0, 673.0, 40.0, 83.0),
    vec4(6.0, 775.0, 40.0, 82.0),
    vec4(914.0, 673.0, 40.0, 83.0),
    vec4(960.0, 673.0, 39.0, 83.0),
    vec4(537.0, 918.0, 22.0, 21.0),
    vec4(458.0, 918.0, 22.0, 22.0),
    vec4(565.0, 918.0, 22.0, 20.0),
    vec4(486.0, 918.0, 20.0, 22.0),
    vec4(512.0, 918.0, 19.0, 22.0),
    vec4(621.0, 918.0, 22.0, 13.0),
    vec4(593.0, 918.0, 22.0, 20.0),
    vec4(224.0, 918.0, 72.0, 69.0),
    vec4(6.0, 918.0, 71.0, 72.0),
    vec4(302.0, 918.0, 72.0, 65.0),
    vec4(83.0, 918.0, 67.0, 72.0),
    vec4(156.0, 918.0, 62.0, 72.0),
    vec4(380.0, 918.0, 72.0, 44.0)
);
// atlas UV of the point (u = 0 / 1 across, f = 0..1 up the sheet) of a region; atlas = (minU, minV, width, height) of the sprite in the block atlas
vec2 tuftUV(float region, float uFlag, float f, vec4 atlas) {
    vec4 rc = TUFT_PX[int(region + 0.5)];
    vec2 px = vec2(rc.x + uFlag * rc.z, rc.y + (1.0 - f) * rc.w);
    return atlas.xy + px / TUFT_SPRITE * atlas.zw;
}

// @@TUFT_END@@

float fogDistance(vec3 pos, int shape) {
    if (shape == 0) {
        return length(pos);
    }
    return max(length(pos.xz), abs(pos.y));
}

void main() {
    // UV0.x = f + 2 * (0 / 1 = left / right edge of the sheet) + 4 * tuft texture region (0 = untextured: imposters, stylized blades)
    float tuftRegion = floor(UV0.x * 0.25);
    float tuftRem = UV0.x - tuftRegion * 4.0;
    float tuftEdge = floor(tuftRem * 0.5);
    float f = tuftRem - tuftEdge * 2.0;   // 0 at the root, 1 at the tip
    float rankQ = floor(UV0.y * 0.25);       // keep rank (0..15) is packed above the blade height
    float H = UV0.y - rankQ * 4.0;           // blade height in blocks
    float rank = (rankQ + 0.5) * (1.0 / 16.0);
    float seed = Color.a;   // per tuft / blade random number

    vec3 p = Position;
    // UV2: low byte = light, bits 8..14 = tuft centre inside the chunk (quantised). Everything below is evaluated
    // at the tuft centre, so a tuft moves as one piece and keeps its shape.
    ivec2 qc = (UV2 >> 8) & 127;
    vec2 centre = vec2(qc) * (17.0 / 127.0) - 0.5;
    vec2 absXZ = ChunkOrigin.xz + centre;
    // SCAVENGER (11/25): stop-motion wind, the time steps 8 times a second (style; Ward's idea)
    float t = floor(WindParams.x * 8.0) / 8.0 * WindParams.w * 0.28;
    float u = f * H;          // distance along the blade, measured from its root
    float rootY = p.y - u;

// @@FADE_BEGIN@@
    // ---------------- fade: far edge + the tufts that the lower detail levels drop + the imposter ----------------
    // Only what is OUTSIDE the screen is weighted by the look direction (x1.5 at 100 degrees off it, nothing up to 62 degrees =
    // everything the screen can show): turning the camera never makes grass grow on the screen. GrassManager.effDist is the same.
    // The weighting is gone from 64 blocks on, so the LOD boundaries further out are plain distances.
    vec2 gzR = ChunkRel.xz + centre;
    float gzD = length(gzR);
    float gzL = length(StyleParams.zw);
    float gzC = (gzL > 0.05 && gzD > 3.0) ? dot(gzR / gzD, StyleParams.zw / gzL) : 1.0;
    float gzG = clamp((0.47 - gzC) / 0.64, 0.0, 1.0) * clamp((64.0 - gzD) / 32.0, 0.0, 1.0);
    float dist = gzD * (1.0 + 0.5 * gzL * gzG);
    // keep rank (0..15) -> the distance where the tufts of that rank are gone. LOD0..LOD2 keep every tuft; LOD3 keeps ranks 0..9
    // (FadeParams.z), LOD4 ranks 0..4 (FadeParams.w), the imposter none (LodParams.x). The shrinking is slow and starts far out
    // (40% of the distance it ends at), where a tuft is only a few pixels: nobody sees grass grow in front of them.
    float vis = 1.0;
    if (rankQ >= 16.0) {
        vis = smoothstep(LodParams.x - 90.0, LodParams.x - 8.0, dist);       // the imposter grows while the last tufts shrink away
    } else {
        float bEnd = LodParams.x;
        float rLo = 0.0;
        float rHi = 5.0;
        if (rankQ >= 10.0) { bEnd = FadeParams.z; rLo = 10.0; rHi = 16.0; }
        else if (rankQ >= 5.0) { bEnd = FadeParams.w; rLo = 5.0; rHi = 10.0; }
        float tq = clamp((rankQ + 0.5 - rLo) / (rHi - rLo), 0.0, 1.0);
        bEnd -= 4.0;                                  // gone 4 blocks before the column can switch to the finer level again
        float bS = bEnd * 0.40;
        float fw = max(3.0, (bEnd - bS) * 0.45);
        float s0 = mix(bS, bEnd - fw, tq);          // higher ranks start to shrink later, so the thinning is gradual
        vis = 1.0 - smoothstep(s0, s0 + fw, dist);
    }
    vis *= 1.0 - smoothstep(LodParams.y, LodParams.z, dist);
    p.xz = centre + (p.xz - centre) * vis;
    u *= vis;
// @@FADE_END@@

    // ---------------- trample (blades fold down onto the ground, get dark, then recover) ----------------
    float lie = 0.0;
    vec2 pushDir = vec2(0.0);
    float cutH = 2.0;                                           // cut height of the blades here (blocks; 2 = not cut)
    if (WindParams.z > 0.5) {
        vec2 rel = ChunkRel.xz + centre;                     // horizontal offset from the camera
        float rl = length(rel);
        float win = 1.0 - smoothstep(22.0, 28.0, rl);          // the trample is read ~28 blocks around the camera
        float cwin = 1.0 - smoothstep(50.0, 58.0, rl);         // the cut is read much further (round 15e): the map is 128 blocks wide now
        if (cwin > 0.0) {
            vec4 tr = textureLod(Sampler1, fract(absXZ / 128.0), 0.0);
            lie = smoothstep(0.06, 0.70, tr.r) * win;
            vec2 d = tr.gb * 2.0 - 1.0;
            float dl = length(d);
            pushDir = dl > 0.001 ? d / dl : vec2(0.0);
            cutH = mix(2.0, tr.a * 2.0, cwin);               // (the alpha of the map: the cut height / 2)
        }
    }
    // ---------------- cut (a sword swung over the grass, see TrailField.swordCut): the tuft is made SHORT (cutH blocks): a whole, smaller plant
    // with the tips of its leaves (1.1.0: it used to be sliced off flat, which was not pretty). The position is squashed (u), the texture row (fTex) and the bend still follow the whole sheet, and
    // the sheet gets a little narrower, so the short plant keeps its proportions. Textured tufts and the untextured blades (regions 0..192); the imposters (far) and the ground cover
    // (clover, ferns, carpet, lawn blades: regions 193 and up, low anyway) are left alone.
    float fTex = f;
    if (cutH < 1.995 && tuftRegion < 192.5 && rankQ < 16.0) {
        float ck = clamp(cutH / max(H, 0.02), 0.0, 1.0);
        u *= ck;
        p.xz = centre + (p.xz - centre) * mix(1.0, ck, 0.55);
    }

// @@WIND_BEGIN@@
    // ---------------- wind: wandering direction, narrow fast gust bands, turbulence, quick wobble ----------------
    float strength = WindParams.y;
    // (round 14) THE DIRECTION NEVER CHANGES: one fixed direction for the whole world and for all time (the author: the wind must not turn; only the size of
    // the gusts varies). The mod puts it in WfWind.xy (z = 0.25 = "direction given"): the Windfall mod's wind direction setting when it is installed,
    // else 90 degrees (= east, Windfall's default). Before, the direction wandered (+-29 degrees over minutes, a little different from place to place) and turned
    // by up to 26 degrees from lane to lane, and because all the patterns are laid out along / across the wind, a small turn made them slide sideways.
    vec2 wd = WfWind.z > 0.1 ? WfWind.xy : vec2(1.0, 0.0);
    vec2 sd = vec2(-wd.y, wd.x);
    float along = dot(absXZ, wd);
    float across = dot(absXZ, sd);
    // gust = rolling swells like sea waves: long curved crests one behind the other, only about 11..22 blocks apart along the wind, so many
    // crests are on the screen at once and one passes every second or so. The crests are not straight planks: a slow noise of the place (two wide
    // sines, one of them bent by a third) pushes every crest forward / back by up to about 3.5 blocks from place to place, a little differently for each
    // crest (the second swell has its own share of it), so they curve, bulge and drift out of line, and the strength along a crest is patchy too (below)
    // (round 14b) THE CRESTS TRAVEL ALONG THE WIND EVERYWHERE. The crests used to be rings round a point 500 blocks upwind of the WORLD ORIGIN (rr = the distance
    // to that point), so the direction a crest travels was the direction away from that point: the same as the wind only on the line through the origin and
    // turned by atan(distance from that line / 500) elsewhere (45 degrees 500 blocks to the side, 63 degrees at 1000): far from (0, 0) the gust waves moved
    // across the wind, and Windfall's leaves (which follow the wind direction) went another way. Now a crest is a front across the wind with a gentle bend:
    // rr = the distance along the wind plus a bounded bend (the crest tilts by at most about 16 degrees from place to place).
    float rr = along + 12.0 * sin(across * 0.014 + 0.9) + 4.0 * sin(across * 0.031 - 1.3);
    // (0.2.50: a 2D noise of the place that is NOT lined up with the wind (wn, two sines of crossing directions) bends the crests much more, so the gusts
    // are curved, uneven blobs and no longer straight boards sweeping over the field)
    float wn = sin(absXZ.x * 0.093 + absXZ.y * 0.071 + t * 0.19 + 1.1 * sin(absXZ.y * 0.047 - t * 0.12))
             * sin(absXZ.x * -0.057 + absXZ.y * 0.088 - t * 0.13 + 0.9 * sin(absXZ.x * 0.039 + t * 0.10));
    float wp = 1.1 * sin(across * 0.050 + along * 0.022 + t * 0.22 + 1.2 * sin(along * 0.035 - across * 0.018 + t * 0.15))
             + 0.45 * sin(across * 0.080 - along * 0.040 - t * 0.33);
    // (0.2.50 round 13) BROKEN CRESTS: wp and wn above are slow and wide (50..125 blocks), so a crest was still a long, nearly straight board over the whole
    // field, and the ever-rolling swell (roll, below) was perfectly straight stripes. Now two medium-size swirls of the place (about 25..60 blocks, drifting
    // slowly downwind) shift every crest forward / back by up to about a third of the crest spacing from place to place (cw: the crests bend, jog and
    // split), and a patch mask (cmask: 0 .. 1, a front is only 15..40 blocks long) makes a crest strong in one patch and nearly gone in the next: a gust is a
    // finite blob that travels, not a plank. The mean push stays the same (cmask scales the gust by 0.55 .. 1.45).
    float axT = along - t * 3.0;
    float cw1 = sin(across * 0.16 + axT * 0.07 + t * 0.35 + 1.4 * sin(axT * 0.10 - across * 0.09 + t * 0.21));
    float cw2 = sin(across * -0.11 + axT * 0.13 - t * 0.28 + 1.1 * sin(across * 0.15 + axT * 0.08 + 1.7));
    float cw = 0.7 * (cw1 + 0.7 * cw2);
    float cm1 = sin(across * 0.13 + axT * 0.05 + t * 0.30 + 1.5 * sin(across * 0.07 - axT * 0.11 - t * 0.17));
    float cm2 = sin(across * -0.09 + axT * 0.11 - t * 0.23 + 1.2 * sin(across * 0.12 + axT * 0.06 + 2.0));
    float cmask = smoothstep(-0.55, 0.75, 0.6 * cm1 + 0.4 * cm2);
    float g1 = sin(rr * 0.36 - t * 8.0 + wp + 1.5 * wn + cw);   // (0.2.50: wider and slower crests, bent by the noise)
    float g2 = sin(rr * 0.60 - t * 8.0 + across * 0.08);    // soft ripples riding on the band
    // a second band system of another size and speed: where the crests meet there is a strong gust, where they cancel a light one
    float g3 = sin(rr * 0.25 - t * 5.6 - 0.6 * wp - 1.2 * wn + 0.7 * cw);
    float gmix = 0.65 * g1 + 0.35 * g3;                 // one swell leads, the other gives it uneven heights
    // (round 14) GUSTS OF DIFFERENT SIZES: besides the two ordinary swells (crests 17 / 25 blocks apart) there is a wide slow swell (about 57 blocks between
    // crests, a big soft puff that rolls over the field) and a fine fast flutter (about 7 blocks, many small quick gusts). Two place noises (sa, sb: patches
    // 40..120 blocks, drifting slowly) decide how much of each one a place gets (up to 85% wide, up to 60% fine, the rest the ordinary swells), so one place
    // has big soft gusts, the next small quick ones, the next the plain mix. The direction is the same for all of them; only their size changes.
    float g4 = sin(rr * 0.11 - t * 3.4 + 0.7 * wp + 0.9 * wn);
    float g5 = sin(rr * 0.95 - t * 10.5 + 2.4 * wn + 2.2 * cw + across * 0.12);
    float sa = 0.5 + 0.5 * sin(across * 0.045 - axT * 0.035 + t * 0.09 + 1.3 * sin(across * 0.03 + axT * 0.05 - t * 0.07 + 0.6));
    float sb = 0.5 + 0.5 * sin(across * -0.052 + axT * 0.041 - t * 0.11 + 1.2 * sin(axT * 0.036 + across * 0.022 + 2.1));
    float sizeW = 0.85 * smoothstep(0.40, 0.85, sa);
    float sizeF = 0.60 * smoothstep(0.50, 0.92, sb);
    float sizeB = max(0.2, 1.0 - sizeW - sizeF);
    gmix = (sizeB * gmix + sizeW * g4 + sizeF * g5) / (sizeB + sizeW + sizeF);
    // a round wave shape: the crest and the trough are curved (a sine of the sum), never clipped flat and never a steep edge, so a gust
    // swells and dies away gradually instead of snapping the grass down and up
    float gust = (0.5 + 0.40 * sin(gmix * 1.35)) * (0.70 + 0.60 * cmask);   // (0.2.50: a softer swell, the crest 10% lower and the trough 10% higher: the same mean push, no snap; round 13: patchy)
    // slow spells of strong and of light wind, over time and across the land: the gusts are not all alike
    float env = 0.5 + 0.5 * sin(t * 0.37 + along * 0.018 + 2.0 * sin(t * 0.11 + across * 0.012));
    float env2 = 0.5 + 0.5 * sin(t * 0.83 - along * 0.04 + 1.3 * sin(across * 0.03 + t * 0.29));
    float gAmp = 0.55 + 0.75 * env * (0.55 + 0.45 * env2);
    // patchy strength: the same crest is strong in one place and light in another (a wide field, +-27%, drifting slowly)
    float pat = 0.5 + 0.5 * sin(across * 0.075 + along * 0.034 - t * 0.45 + 1.3 * sin(across * 0.031 - along * 0.020 + t * 0.17));
    // (0.2.50 round 10) WIND ZONES: the land is not under one wind. Wide, smooth lanes of strong and of calm wind (stretched along the wind, about 50..150 blocks
    // across, wavy, drifting slowly downwind) make a gust that is strong here light 60 blocks away, and the wind veers a little from lane to lane. Before, the
    // difference was in the numbers but not on the screen: every tuft's bend sat at its cap, so the whole field looked alike (see wi below, which also frees the bend).
    float zA = sin(across * 0.046 + 1.5 * sin(along * 0.011 + t * 0.07 + across * 0.009) + t * 0.11 + 0.6);
    float zB = sin(across * 0.081 + along * 0.019 - t * 0.14 + 1.2 * sin(along * 0.027 - across * 0.021 + t * 0.09) + 2.3);
    float zC = sin(across * 0.021 - along * 0.012 + t * 0.05 + 1.0 * sin(across * 0.034 + along * 0.016 + 4.0));
    float zone = mix(0.30, 1.75, smoothstep(0.12, 0.88, 0.5 + 0.5 * (0.45 * zA + 0.30 * zB + 0.25 * zC)));
    gust = gust * gAmp * (0.85 + 0.30 * pat) * zone * (0.88 + 0.24 * (0.5 + 0.5 * wn));
    // (round 15) A FLOOR FOR THE WIND: the calm lanes, the light spells and the troughs of the swells multiplied each other and the grass came close to
    // standing still. gust = 0.16 + 0.84 * gust keeps the shape and lifts the quietest moments: the push of the quietest 5% of the places and times is about
    // 0.40 (a numeric copy of the formula; it was 0.27) and the middle one 0.58 (was 0.47), the strong gusts are the same.
    gust = 0.16 + 0.84 * gust;
    // distance of this tuft from the camera: the far levels skip the fine wind detail (below), nobody can see it there
    float dLod = length(ChunkRel.xz + centre);
    float lod0 = max(floor(LodParams.w), 16.0);          // (fixed 52: the wobble does not follow the size of the LOD zones)
    // the fraction of LodParams.w carries the lean variety (0.2 x leanScatter() = the Lean slider, GrassConfig.lodFlag): 0 = every tuft leans the wind's way as before; the plants (their own
    // uniforms) always have 0 here
    float scat = clamp(fract(LodParams.w) * 5.0, 0.0, 2.0);
    // streaks along the wind (a stretched, wavy noise): lanes a few blocks wide and long along the wind, bent sideways into slow waves and
    // drifting downwind slower than the swells. They make the push uneven from lane to lane (+-26%) and so the colour of the grass
    // (a pushed tuft is darker, a standing one lighter): one noise for the motion and the colour
    float stK = 0.0;
    if (dLod < 150.0) {           // the lanes fade out between 90 and 150 blocks (about LOD2 / LOD3): not computed beyond
        float stU = across + 3.5 * sin(along * 0.22 + t * 0.9) + 1.8 * sin(along * 0.47 - t * 1.7 + across * 0.05);
        float stV = along * 0.055 - t * 0.8;
        stK = (0.46 * sin(stU * 0.62 + 1.7 * sin(stV * 0.9 + 1.3))
             + 0.32 * sin(stU * 1.07 + 2.3 + 1.9 * sin(stV * 0.6 + 4.0))
             + 0.22 * sin(stU * 1.83 + 5.1 + 1.2 * sin(stV * 1.3 + 0.7))) * (1.0 - smoothstep(90.0, 150.0, dLod));
    }
    gust = clamp(gust * (1.0 + 0.26 * stK), 0.0, 1.3);
    if (WfWind.z > 0.5) {
        // the gusts of Windfall: a blob that sweeps over the land (its leaf piles blow in the same gust)
        float wf = 0.0;
        vec2 wr0 = mod(absXZ - WfWave0.xy + 2048.0, 4096.0) - 2048.0;
        float wl0 = dot(wr0, WfWave0.zw);
        float wc0 = dot(wr0, vec2(-WfWave0.w, WfWave0.z));
        float wt0 = clamp(1.0 - abs(wc0 - WfWave1.z) / max(WfWave1.y * 0.9, 1.0), 0.0, 1.0);
        float wq0 = wl0 - WfWave1.x;
        wf = max(wf, WfWave1.w * wt0 * wt0 * (3.0 - 2.0 * wt0)
                     * (wq0 < 0.0 ? exp(wq0 * 0.12) : exp(-wq0 * wq0 * 0.2)));
        vec2 wr1 = mod(absXZ - WfWave2.xy + 2048.0, 4096.0) - 2048.0;
        float wl1 = dot(wr1, WfWave2.zw);
        float wc1 = dot(wr1, vec2(-WfWave2.w, WfWave2.z));
        float wt1 = clamp(1.0 - abs(wc1 - WfWave3.z) / max(WfWave3.y * 0.9, 1.0), 0.0, 1.0);
        float wq1 = wl1 - WfWave3.x;
        wf = max(wf, WfWave3.w * wt1 * wt1 * (3.0 - 2.0 * wt1)
                     * (wq1 < 0.0 ? exp(wq1 * 0.12) : exp(-wq1 * wq1 * 0.2)));
        vec2 wr2 = mod(absXZ - WfWave4.xy + 2048.0, 4096.0) - 2048.0;
        float wl2 = dot(wr2, WfWave4.zw);
        float wc2 = dot(wr2, vec2(-WfWave4.w, WfWave4.z));
        float wt2 = clamp(1.0 - abs(wc2 - WfWave5.z) / max(WfWave5.y * 0.9, 1.0), 0.0, 1.0);
        float wq2 = wl2 - WfWave5.x;
        wf = max(wf, WfWave5.w * wt2 * wt2 * (3.0 - 2.0 * wt2)
                     * (wq2 < 0.0 ? exp(wq2 * 0.12) : exp(-wq2 * wq2 * 0.2)));
        gust = max(gust, clamp(wf * 1.15, 0.0, 1.0));
    }
    // the wind weakens with the detail level (distance): the wobble fades out between lod0 (LodParams.w = 52) and
    // 2.2x that (about 114 blocks; it is gone, and not even computed, from there on); the lean of the far grass is a little smaller too
    float wl = 1.0 - 0.9 * smoothstep(lod0, lod0 * 2.2, dLod);
    float turb = 0.5 + 0.5 * g2;
    float breeze = 0.22 + 0.07 * sin(t * 2.2 + along * 0.4);
    float push = (breeze + 0.95 * gust * (0.80 + 0.20 * turb)) * strength * 1.25 * (1.0 - 0.30 * smoothstep(lod0 * 3.0, lod0 * 9.0, dLod));   // (round 10: x1.25, the wind was too still)
    // windiness of the place, 0 (calm lane) .. 1 (strong lane): smooth, no fast gusts in it. It decides how much of its own lean a tuft keeps, how scattered the
    // tufts are and how much they sway, so the lanes show on the screen
    float wi = clamp((zone * (0.55 + 0.45 * env) - 0.35) / 0.9, 0.0, 1.0);
    float pushC = push;                      // the push for the colour: one smooth field
    float ph = seed * 6.2831853;
    float wob = 0.0;
    // Wobble: every tuft sways from side to side and breathes (leans a little more, a little less) slowly and widely, each with a phase of its own
    // along the wind, so the field ripples instead of moving as one piece. It is done in ANGLE space after the bend is capped (see below): with a
    // strong wind and a big Lean most tufts sit at the cap, and a wobble added to the push would be squashed away (that made the grass look stiff).
    // Slow on purpose (4 .. 16 s) and driven by the slow wind spells (env), not by the quick swells: nothing trembles.
    float swayA = 0.0;
    float breathe = 0.0;
    if (wl > 0.101 && strength > 0.001) {   // (wind 0 / "Wind" off: nothing sways)
        float s1 = sin(t * (2.0 + 1.5 * fract(seed * 7.31)) + ph + along * 0.45);          // about 4 .. 7 s
        float s2 = sin(t * (0.9 + 0.6 * fract(seed * 3.7)) + ph * 1.7 + along * 0.20);      // about 10 .. 16 s
        float s3 = sin(t * (1.5 + 1.1 * fract(seed * 5.1)) + ph * 0.7 + along * 0.35);      // about 5 .. 10 s
        float sq = clamp(strength * 0.30, 0.2, 1.6);                                       // 0.64 at the default wind strength (2.145)
        // (the strength of the wobble only varies a little with the wind spells: it must never die away, or the grass stands still between the gusts)
        float wv = wl * sq * (0.85 + 0.30 * env2) * (0.75 + 0.55 * wi) * 0.85;   // (round 10b: the tuft wobble x0.85, was x1.3 in round 10)
        float wa = 0.85 + 0.25 * env;
        swayA = (0.55 * s1 + 0.45 * s2) * 0.56 * wa * wv;                                   // side to side, swings of about +-32 degrees
        breathe = (0.55 * s3 + 0.45 * s2) * 0.28 * wa * wv;                                 // more / less bent, about +-16 degrees
        // The ever-rolling swell: two long waves roll along the wind all the time, whatever the gusts do, so the grass is never still
        // between the gusts. Their phase follows the PLACE (along the wind), not a random phase of the tuft: tufts next to each other
        // swing together and the field ripples in waves (about 11 and 19 blocks long; one passes every ~2.7 s / ~4.2 s at wind speed 1.58).
        // At the default wind strength: about +-22 degrees of side swing and +-7 degrees of bend, fading out with the distance like the wobble.
        // (round 13: it was perfectly straight stripes across the whole field, the 'plank waves'. The place noise bends the phase much more now (cw), and a
        // patch mask of its own (rmask, patches about 20..60 blocks) lets the swell be strong in one patch and nearly still in the next, so the stripes
        // break up into curved, uneven pieces that come and go)
        float rmask = 0.65 + 0.70 * smoothstep(-0.6, 0.6, 0.55 * sin(across * 0.17 - along * 0.06 - t * 0.27 + 1.3 * sin(across * 0.09 + along * 0.13 + t * 0.14))
                                                  + 0.45 * sin(across * -0.10 + along * 0.12 + t * 0.22 + 1.1 * sin(along * 0.08 - across * 0.11 + 0.9)));
        float roll = (0.6 * sin(t * 5.2 - along * 0.55 + 0.8 * wp + 1.3 * wn + 0.8 * cw)
                    + 0.4 * sin(t * 3.3 - along * 0.33 + 1.7 - 0.6 * wp - 1.0 * wn - 0.6 * cw)) * rmask;
        float rq = wl * (sq / 0.64);
        swayA += 0.38 * roll * rq * (0.75 + 0.55 * wi) * 1.1;   // (round 10b: the rolling swell x1.1, was x1.3)
        breathe += 0.12 * roll * rq;
    }
    // every tuft also keeps its own lasting turn of the lean direction (up to about +-75 degrees around the wind, a little less in the strong spells), so the
    // field is not combed one way: crests of wind line the tufts up a bit more, the lulls between them scatter them again
    swayA += (fract(seed * 53.7) - 0.5) * 2.0 * (1.3 + 0.5 * scat) * (1.0 - 0.35 * env) * (0.4 + 0.6 * wl) * (1.0 - clamp(0.6 - 0.45 * scat, 0.0, 0.6) * wi);
    // a tuft is a flat sheet (seed = its yaw / pi): it bends across the sheet, not along it, so it never shears
    float yawS = seed * 3.14159265;
    vec2 pax = vec2(cos(yawS), sin(yawS));
    vec2 pnr = vec2(-pax.y, pax.x);
    vec2 W = wd * push + sd * wob;   // (round 14: no veer from lane to lane any more, the direction is the same everywhere)
    W = pnr * dot(W, pnr) + pax * (dot(W, pax) * 0.35);
    // (Lean variety) every sheet answers the wind in a way of its own: a stiff one hardly moves, a floppy one bends far (0.4 .. 1.6 x at the default)
    W *= max(mix(1.0, 0.40 + 1.2 * fract(seed * 43.7 + 0.61), scat), 0.2);
    // every tuft also leans to one side of its sheet at rest
    // ... and always to the DOWNWIND side of its sheet (it used to be a random side: against the wind the tuft first stood straight
    // and then fell over to the other side, so the grass seemed to be blown both ways); smooth, so a sheet that is edge-on to the wind does not flip
    float restSide = clamp(dot(wd, pnr) * 4.0, -1.0, 1.0);
    float rest = (0.45 + 0.65 * fract(seed * 91.7)) * StyleParams.y * (0.60 + 0.40 * wi);   // (round 10: tufts lean over more where the wind is strong, stand up a little more in calm lanes)
    // ... plus a smaller lean of its own, in a direction of its own: the field is not all combed the same way, but a tuft
    // never leans so far against the wind that it swings through upright when a gust comes
    float leanA = fract(seed * 37.13 + 0.31) * 6.2831853;
    // a tuft's own lean points anywhere around the circle except mostly not against the wind: the field is scattered (not combed one
    // way), yet a gust blows every tuft the same way and none swings through upright against it
    vec2 rnd = vec2(cos(leanA), sin(leanA));
    rnd -= wd * min(dot(rnd, wd), 0.0) * clamp(0.7 - 0.55 * scat, 0.0, 0.7);   // (Lean variety: a sheet may lean against the wind, too)
    // (Lean variety) about one sheet in eight lies over (lodged grass), and every sheet has its own stiffness: some stand up, some tilt, some fall, in all directions
    float fall = step(0.88, fract(seed * 29.3 + 0.11));
    vec2 L = W + pnr * (restSide * rest * 0.22) + rnd * ((0.55 + 0.30 * scat) * rest * (1.0 - 0.5 * wi) + fall * scat * 0.9 * rest);   // strong lanes comb the tufts the way of the wind, calm lanes leave them scattered
    L *= max(mix(1.0, 0.12 + 2.15 * pow(fract(seed * 71.9 + 0.27), 1.5), scat), 0.04);
    // Lean 0..2 is the old range (bend cap 0.8 rad); the slider goes to 5, and what is above 2 raises the cap so the tufts
    // really lie further over (the cap stops at 1.5 rad = 86 degrees, nearly flat)
    float leanX = max(StyleParams.y - 2.0, 0.0);
    float m = length(L);
    vec2 ld = m > 0.0001 ? L / m : pnr;
    // the bend angle grows with the push and rounds off smoothly toward its cap (no flat plateau where every tuft lies at the same angle)
    // how far up the blade the bend reaches: a tall tuft bends mostly in its upper part (f^1.2), a low one from its root up (f^0.55), because a low
    // tuft is only two or three straight bands and a band at the root that hardly bends looks like a stiff card under a floppy tip
    float fe = pow(f, mix(0.55, 1.2, smoothstep(0.40, 0.70, H)));
    float bx = m * fe * 0.50;
    float bCap = min(0.95 + 0.25 * leanX, 1.50);      // never past about 86 degrees (a blade must not go below the ground)
    float bend = bx * pow(1.0 + pow(bx / bCap, 4.0), -0.25);
    bend = clamp(bend + breathe * fe, 0.0, 1.50);
    float swC = cos(swayA * fe);
    float swS = sin(swayA * fe);
    ld = vec2(ld.x * swC - ld.y * swS, ld.x * swS + ld.y * swC);
    // colour follows the push: where the wind presses the tufts down they are darker, where they stand up they are lighter
    // (subtle: about +-13% at the leaf tips, nothing at the root), in the same lanes as the motion
    float press = clamp((pushC / max(strength, 0.3) - 0.25) / 1.1 + 0.16 * stK, 0.0, 1.0);
    float shade = (0.5 - press) * (0.45 + 0.55 * clamp(f, 0.0, 1.0));
    vec3 sheenMul = vec3(1.0) + shade * 0.30 * vec3(0.26, 0.28, 0.12);       // fixed at 0.30 of the +-13% (round 10: was 0.20): a hint of colour, no more
    float a = mix(bend, 1.45, lie);                           // bend angle (rad); trampled = tipped over almost flat
    // trampled: the whole tuft tips over like a flap, to the side the wind / walking pushes it
    float side = dot(pnr, ld * 0.5 + pushDir * 0.5) >= 0.0 ? 1.0 : -1.0;
    vec2 dm = mix(ld, pnr * side, smoothstep(0.0, 0.5, lie));
    vec2 dir = length(dm) > 0.001 ? normalize(dm) : pnr;
    // ---------------- Leaf curl: every sheet of a tuft twists about the vertical axis the higher it goes (0 at the root, about 28 degrees at the tip at Leaf curl 1.0), to
    // a side of its own (the seed of the sheet), so seen from above the sheets are no longer flat planes with straight lines where two of them cross. The root does not
    // move (no floating). Only the textured grass tufts (regions 1..192): not the imposters, the clover, the ferns, the carpet and the flowers (regions 193 and up). The
    // amount rides in the fraction of WindParams.z (z = trail on / off + 0.2 x Leaf curl: GrassConfig.windFlag), and it fades out between 40 and 90 blocks.
    float curlAmt = (WindParams.z - (WindParams.z > 0.5 ? 1.0 : 0.0)) * 5.0;
    if (curlAmt > 0.01 && tuftRegion > 0.5 && tuftRegion < 192.5 && rankQ < 16.0) {
        float cMag = 0.55 + 0.45 * fract(seed * 23.9 + 0.43);
        float cDir = fract(seed * 61.7 + 0.17) < 0.5 ? -1.0 : 1.0;
        float cA = cDir * cMag * 0.50 * curlAmt * pow(f, 1.25) * (1.0 - smoothstep(40.0, 90.0, dLod));
        float cC = cos(cA);
        float cS = sin(cA);
        vec2 cO = p.xz - centre;
        p.xz = centre + vec2(cO.x * cC - cO.y * cS, cO.x * cS + cO.y * cC);
    }
    // rotate about the root (no stretching): the blade keeps its length
    p.xz += dir * (u * sin(a));
    p.y = rootY + u * cos(a);
// @@WIND_END@@

    vec4 light = texture(Sampler2, clamp(vec2(UV2 & 255) / 256.0, vec2(0.5 / 16.0), vec2(15.5 / 16.0)));
    vec3 baseCol = Color.rgb * sheenMul * (tuftRegion > 0.5 ? TUFT_SMAX : 1.0);   // textured tufts: the texture holds shade / TUFT_SMAX
    // wet grass (rain, then it dries slowly): a little darker and a touch more saturated
    baseCol *= vec3(1.0) - clamp(StyleParams.x, 0.0, 1.0) * vec3(0.17, 0.12, 0.16);
    vertexColor = vec4(baseCol, 1.0) * light;
    texUV = tuftRegion > 0.5 ? tuftUV(tuftRegion, tuftEdge, fTex, TuftAtlas) : vec2(-1.0);

    gl_Position = ProjMat * ModelViewMat * vec4(p, 1.0);
    vertexDistance = fogDistance((ModelViewMat * vec4(p, 1.0)).xyz, FogShape);
}
