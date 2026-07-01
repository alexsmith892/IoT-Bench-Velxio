// cooperative_scheduler (OS-D3-10) — reference solution.
// Four independent 50%-duty blink schedules on D4=1 Hz, D5=2 Hz, D6=3 Hz, D7=5 Hz,
// all starting LOW and in phase at startup. A button on D2 (INPUT_PULLUP) is
// mirrored to an active-high response LED on D8 within 20 ms, even while paused.
// Serial @115200: PAUSE freezes all four outputs and stops their schedules
// (OK PAUSED); RESUME continues so each LED's phase is preserved — the pattern
// just shifts later by the paused duration, with no catch-up burst (OK RUNNING).
// A repeated PAUSE/RESUME is idempotent; anything else replies ERR.
//
// Mechanism: a virtual-time clock `vUs` advances with real time only while running.
// Pausing stops it and resuming continues it, so phase preservation is automatic
// and there is no burst of catch-up edges.

const int LED[4] = { 4, 5, 6, 7 };
const unsigned long PERIOD_US[4] = { 1000000UL, 500000UL, 333333UL, 200000UL };
const int BTN = 2;
const int RESP = 8;

unsigned long vUs = 0;       // virtual microseconds (frozen while paused)
unsigned long lastUs = 0;
bool paused = false;

char line[16];
int len = 0;
bool overlong = false;

void handleLine() {
  line[len] = '\0';
  if (strcmp(line, "PAUSE") == 0) { paused = true; Serial.println("OK PAUSED"); return; }
  if (strcmp(line, "RESUME") == 0) { paused = false; Serial.println("OK RUNNING"); return; }
  Serial.println("ERR");
}

void setup() {
  for (int i = 0; i < 4; i++) { pinMode(LED[i], OUTPUT); digitalWrite(LED[i], LOW); }
  pinMode(BTN, INPUT_PULLUP);
  pinMode(RESP, OUTPUT);
  digitalWrite(RESP, LOW);
  Serial.begin(115200);
  lastUs = micros();
}

void loop() {
  unsigned long nowUs = micros();
  unsigned long dt = nowUs - lastUs;
  lastUs = nowUs;
  if (!paused) vUs += dt;

  // Each LED starts LOW: LOW for the first half of its period, HIGH for the second.
  for (int i = 0; i < 4; i++) {
    unsigned long ph = vUs % PERIOD_US[i];
    digitalWrite(LED[i], ph < PERIOD_US[i] / 2 ? LOW : HIGH);
  }

  // Button mirror runs unconditionally (even while paused).
  digitalWrite(RESP, digitalRead(BTN) == LOW ? HIGH : LOW);

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
