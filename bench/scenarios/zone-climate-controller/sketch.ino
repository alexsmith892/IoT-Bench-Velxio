// OS-D4-05 reference. Two-zone climate controller with serial config + fault interlock.

static const uint8_t FAULT_PIN = 2;
static const uint8_t HEATER1_PIN = 6;
static const uint8_t HEATER2_PIN = 7;
static const uint8_t ADC_Z1 = A0;
static const uint8_t ADC_Z2 = A1;
static const float SP_MIN = 10.0f;
static const float SP_MAX = 30.0f;
static const float HYST = 0.5f;
static const unsigned long SAMPLE_MS = 100;

float sp1 = 21.0f;
float sp2 = 21.0f;
float t1 = 0.0f;
float t2 = 0.0f;
bool h1 = false;
bool h2 = false;
bool faultActive = false;
bool sampled = false;
unsigned long lastSample = 0;

float readTempC(uint8_t pin) {
  int raw = analogRead(pin);
  float volts = raw * (5.0f / 1023.0f);
  return (volts - 0.5f) / 0.01f;
}

void setHeater(uint8_t pin, bool on) {
  digitalWrite(pin, on ? LOW : HIGH);
}

void applyHeaters() {
  if (faultActive || !sampled) {
    setHeater(HEATER1_PIN, false);
    setHeater(HEATER2_PIN, false);
    h1 = false;
    h2 = false;
    return;
  }
  if (t1 <= sp1 - HYST) h1 = true;
  else if (t1 >= sp1 + HYST) h1 = false;
  if (t2 <= sp2 - HYST) h2 = true;
  else if (t2 >= sp2 + HYST) h2 = false;
  setHeater(HEATER1_PIN, h1);
  setHeater(HEATER2_PIN, h2);
}

void pollFault() {
  bool f = digitalRead(FAULT_PIN) == LOW;
  if (f != faultActive) {
    faultActive = f;
    applyHeaters();
  }
}

void sampleZones() {
  unsigned long now = millis();
  if (now - lastSample < SAMPLE_MS) return;
  lastSample = now;
  t1 = readTempC(ADC_Z1);
  t2 = readTempC(ADC_Z2);
  sampled = true;
  applyHeaters();
}

char lineBuf[32];
uint8_t lineLen = 0;

bool parseSet(const char *line, uint8_t len) {
  if (len < 5 || strncmp(line, "SET ", 4) != 0) return false;
  int zi = line[4] - '0';
  if (zi != 1 && zi != 2) return false;
  if (line[5] != ' ') return false;
  float v = atof(line + 6);
  if (v < SP_MIN || v > SP_MAX) return false;
  if (zi == 1) sp1 = v;
  else sp2 = v;
  applyHeaters();
  Serial.println(F("OK"));
  return true;
}

void printStatus() {
  Serial.print(F("Z1 T="));
  Serial.print(t1, 1);
  Serial.print(F(" S="));
  Serial.print(sp1, 1);
  Serial.print(F(" H="));
  Serial.print(h1 ? F("ON") : F("OFF"));
  Serial.print(F(" Z2 T="));
  Serial.print(t2, 1);
  Serial.print(F(" S="));
  Serial.print(sp2, 1);
  Serial.print(F(" H="));
  Serial.print(h2 ? F("ON") : F("OFF"));
  Serial.print(F(" FAULT="));
  Serial.println(faultActive ? F("ON") : F("OFF"));
}

void handleLine(const char *line, uint8_t len) {
  if (len == 6 && strncmp(line, "STATUS", 6) == 0) {
    printStatus();
    return;
  }
  if (parseSet(line, len)) return;
  Serial.println(F("ERR"));
}

void pollSerial() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (lineLen > 0) {
        lineBuf[lineLen] = '\0';
        handleLine(lineBuf, lineLen);
        lineLen = 0;
      }
    } else if (lineLen < sizeof(lineBuf) - 1) {
      lineBuf[lineLen++] = c;
    }
  }
}

void setup() {
  pinMode(FAULT_PIN, INPUT_PULLUP);
  pinMode(HEATER1_PIN, OUTPUT);
  pinMode(HEATER2_PIN, OUTPUT);
  setHeater(HEATER1_PIN, false);
  setHeater(HEATER2_PIN, false);
  Serial.begin(115200);
  analogReference(DEFAULT);
  lastSample = millis();
}

void loop() {
  pollFault();
  sampleZones();
  pollSerial();
}
