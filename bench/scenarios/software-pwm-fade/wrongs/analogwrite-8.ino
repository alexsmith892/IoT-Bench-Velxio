// software_pwm_fade — adversarial wrong "analogwrite-8".
// Uses analogWrite() on D8. D8 (PB0) has no hardware PWM, so analogWrite just
// digital-writes HIGH (value ≥128) or LOW (value <128): no 200 Hz carrier is ever
// produced. Fails the `frequency` contract (the pin never toggles at 200 Hz).

const int PWM_PIN = 8;
int duty = 0;

char line[24];
int len = 0;
bool overlong = false;

long parseNum(const char* s, long hi) {
  if (!*s) return -1;
  long v = 0;
  for (; *s; s++) {
    if (*s < '0' || *s > '9') return -1;
    v = v * 10 + (*s - '0');
    if (v > hi) return -1;
  }
  return v;
}

void handleLine() {
  line[len] = '\0';
  char* tok[4];
  int n = 0;
  char* p = line;
  while (*p && n < 4) {
    while (*p == ' ') p++;
    if (!*p) break;
    tok[n++] = p;
    while (*p && *p != ' ') p++;
    if (*p) *p++ = '\0';
  }
  if (n >= 1) {
    for (char* s = tok[0]; *s; s++) if (*s >= 'a' && *s <= 'z') *s -= 32;
    if (n == 2 && strcmp(tok[0], "DUTY") == 0) {
      long d = parseNum(tok[1], 255);
      if (d >= 0) { duty = (int)d; analogWrite(PWM_PIN, duty); Serial.print("OK DUTY="); Serial.println(d); return; }
    } else if (n == 3 && strcmp(tok[0], "RAMP") == 0) {
      long d = parseNum(tok[1], 255);
      long ms = parseNum(tok[2], 10000);
      if (d >= 0 && ms >= 1) { duty = (int)d; analogWrite(PWM_PIN, duty); Serial.print("OK RAMP="); Serial.println(d); return; }
    }
  }
  Serial.println("ERR");
}

void setup() {
  pinMode(PWM_PIN, OUTPUT);
  analogWrite(PWM_PIN, 0);
  Serial.begin(115200);
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      if (overlong) { Serial.println("ERR"); overlong = false; }
      else handleLine();
      len = 0;
      continue;
    }
    if (len >= 23) overlong = true;
    else line[len++] = c;
  }
}
