// servo_slew_position (OS-D3-06) — reference solution.
// Directly generate a 50 Hz servo pulse train on D9 (no Servo library): one HIGH
// pulse every 20 ms, width 1000µs=0° … 2000µs=180°, start 90° (1500µs). Serial
// @115200 accepts "POS n" (n 0..180) → set target, reply "OK POS=n"; malformed /
// out-of-range → "ERR", change nothing. The angle slews toward the target at no
// more than 90°/s (never jumps), updating the pulse width as it moves, then holds.
// Pulse generation and serial stay responsive throughout (non-blocking, micros-paced).

const int SERVO_PIN = 9;
const unsigned long FRAME_US = 20000;   // 50 Hz frame
const float SLEW_DPS = 90.0;            // degrees per second (the max allowed rate)

float angle = 90.0;    // current angle
float target = 90.0;   // commanded target
unsigned long frameStart = 0;
unsigned long pulseStart = 0;
bool pulseHigh = false;
unsigned int pulseUs = 1500;
unsigned long lastSlew = 0;

char line[16];
int len = 0;
bool overlong = false;

unsigned int angleToUs(float a) {
  return (unsigned int)(1000.0 + (a / 180.0) * 1000.0 + 0.5);
}

void slew() {
  unsigned long now = millis();
  unsigned long dt = now - lastSlew;
  if (dt < 4) return;  // update every few ms: keeps the loop fast so pulse edges stay crisp
  lastSlew = now;
  float step = SLEW_DPS * dt / 1000.0;
  if (angle < target) { angle += step; if (angle > target) angle = target; }
  else if (angle > target) { angle -= step; if (angle < target) angle = target; }
}

void handleLine() {
  line[len] = '\0';
  if (strncmp(line, "POS ", 4) == 0) {
    const char* q = line + 4;
    if (*q) {
      long v = 0;
      bool ok = true;
      for (const char* s = q; *s; s++) {
        if (*s < '0' || *s > '9') { ok = false; break; }
        v = v * 10 + (*s - '0');
        if (v > 1000) { ok = false; break; }
      }
      if (ok && v >= 0 && v <= 180) {
        target = (float)v;
        Serial.print("OK POS=");
        Serial.println(v);
        return;
      }
    }
  }
  Serial.println("ERR");
}

void setup() {
  pinMode(SERVO_PIN, OUTPUT);
  digitalWrite(SERVO_PIN, LOW);
  Serial.begin(115200);
  frameStart = micros();
  lastSlew = millis();
  pulseUs = angleToUs(angle);
}

void loop() {
  unsigned long nowUs = micros();
  // End the current pulse first, with minimal latency, so the HIGH width is crisp.
  if (pulseHigh && (nowUs - pulseStart >= pulseUs)) {
    digitalWrite(SERVO_PIN, LOW);
    pulseHigh = false;
  }
  if (!pulseHigh && (nowUs - frameStart >= FRAME_US)) {
    frameStart += FRAME_US;
    digitalWrite(SERVO_PIN, HIGH);
    pulseStart = micros();          // latch the start at the actual HIGH edge
    pulseUs = angleToUs(angle);
    pulseHigh = true;
  }
  slew();
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      if (overlong) { Serial.println("ERR"); overlong = false; }
      else handleLine();
      len = 0;
      continue;
    }
    if (len >= 15) overlong = true;
    else line[len++] = c;
  }
}
