// servo_slew_position — adversarial wrong "instant-jump".
// Correct 50 Hz pulse train and correct 1000–2000µs mapping, but it sets the
// angle to the target IMMEDIATELY with no slew — so mid-move the pulse width is
// already at the target instead of ramping. Fails the mid-slew `pulse-width`
// window (which expects an intermediate angle a ≤90°/s slew would still be at).

const int SERVO_PIN = 9;
const unsigned long FRAME_US = 20000;

float angle = 90.0;
unsigned long frameStart = 0;
unsigned long pulseStart = 0;
bool pulseHigh = false;
unsigned int pulseUs = 1500;

char line[16];
int len = 0;
bool overlong = false;

unsigned int angleToUs(float a) {
  return (unsigned int)(1000.0 + (a / 180.0) * 1000.0 + 0.5);
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
        angle = (float)v;  // BUG: jump straight to target, no slew
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
}

void loop() {
  unsigned long nowUs = micros();
  if (pulseHigh && (nowUs - pulseStart >= pulseUs)) {
    digitalWrite(SERVO_PIN, LOW);
    pulseHigh = false;
  }
  if (!pulseHigh && (nowUs - frameStart >= FRAME_US)) {
    frameStart += FRAME_US;
    digitalWrite(SERVO_PIN, HIGH);
    pulseStart = micros();
    pulseUs = angleToUs(angle);
    pulseHigh = true;
  }
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
