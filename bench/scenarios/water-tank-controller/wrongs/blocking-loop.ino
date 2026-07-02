// delay(100) blocks sampling and serial — pump control lags.
#include <EEPROM.h>

static const uint8_t MARKER_ADDR = 4;
static const uint8_t VALID_MARKER = 0xA5;
static const uint8_t LEVEL_PIN = A0;
static const uint8_t PUMP_PIN = 7;
static const uint8_t ALARM_PIN = 6;
static const uint8_t SILENCE_PIN = 2;
static const unsigned long SAMPLE_MS = 50;
static const unsigned long DEBOUNCE_MS = 30;

uint16_t lowTh = 300;
uint16_t highTh = 700;
int level = 0;
bool pumpOn = false;
bool alarmOn = false;
bool alarmSilenced = false;
bool sampled = false;
unsigned long lastSample = 0;

int btnReading = HIGH;
int btnStable = HIGH;
unsigned long btnChangeMs = 0;

void persistThresholds() {
  EEPROM.update(0, (uint8_t)(lowTh & 0xFF));
  EEPROM.update(1, (uint8_t)(lowTh >> 8));
  EEPROM.update(2, (uint8_t)(highTh & 0xFF));
  EEPROM.update(3, (uint8_t)(highTh >> 8));
  EEPROM.update(MARKER_ADDR, VALID_MARKER);
}

void loadThresholds() {
  if (EEPROM.read(MARKER_ADDR) == VALID_MARKER) {
    lowTh = (uint16_t)EEPROM.read(0) | ((uint16_t)EEPROM.read(1) << 8);
    highTh = (uint16_t)EEPROM.read(2) | ((uint16_t)EEPROM.read(3) << 8);
  } else {
    lowTh = 300;
    highTh = 700;
    persistThresholds();
  }
}

void setPump(bool on) {
  pumpOn = on;
  digitalWrite(PUMP_PIN, on ? LOW : HIGH);
}

void setAlarm(bool on) {
  alarmOn = on;
  digitalWrite(ALARM_PIN, on ? HIGH : LOW);
}

void updateControl() {
  if (!sampled) {
    setPump(false);
    setAlarm(false);
    return;
  }
  if (level < 850) {
    setAlarm(false);
    alarmSilenced = false;
  } else if (level >= 900 && !alarmSilenced) {
    setAlarm(true);
  } else if (alarmSilenced) {
    setAlarm(false);
  }
  if (level <= (int)lowTh) setPump(true);
  else if (level >= (int)highTh) setPump(false);
}

void sampleLevel() {
  unsigned long now = millis();
  if (now - lastSample < SAMPLE_MS) return;
  lastSample = now;
  level = analogRead(LEVEL_PIN);
  sampled = true;
  updateControl();
}

void pollSilence() {
  int r = digitalRead(SILENCE_PIN);
  if (r != btnReading) {
    btnReading = r;
    btnChangeMs = millis();
  }
  if (millis() - btnChangeMs >= DEBOUNCE_MS && r != btnStable) {
    btnStable = r;
    if (btnStable == LOW && alarmOn) {
      alarmSilenced = true;
      setAlarm(false);
    }
  }
}

char lineBuf[32];
uint8_t lineLen = 0;

bool parseSet(const char *line, uint8_t len, bool isLow, uint16_t *out) {
  const char *prefix = isLow ? "SET LOW " : "SET HIGH ";
  uint8_t plen = isLow ? 8 : 9;
  if (len < plen || strncmp(line, prefix, plen) != 0) return false;
  long v = atol(line + plen);
  if (v < 0 || v > 1023) return false;
  *out = (uint16_t)v;
  return true;
}

void printStatus() {
  Serial.print(F("LEVEL="));
  Serial.print(level);
  Serial.print(F(" LOW="));
  Serial.print(lowTh);
  Serial.print(F(" HIGH="));
  Serial.print(highTh);
  Serial.print(F(" PUMP="));
  Serial.print(pumpOn ? F("ON") : F("OFF"));
  Serial.print(F(" ALARM="));
  Serial.println(alarmOn ? F("ON") : F("OFF"));
}

void handleLine(const char *line, uint8_t len) {
  if (len == 6 && strncmp(line, "STATUS", 6) == 0) {
    printStatus();
    return;
  }
  uint16_t v;
  if (parseSet(line, len, true, &v)) {
    if (v >= highTh) {
      Serial.println(F("ERR"));
      return;
    }
    lowTh = v;
    persistThresholds();
    updateControl();
    Serial.println(F("OK"));
    return;
  }
  if (parseSet(line, len, false, &v)) {
    if (v <= lowTh) {
      Serial.println(F("ERR"));
      return;
    }
    highTh = v;
    persistThresholds();
    updateControl();
    Serial.println(F("OK"));
    return;
  }
  if (len > 0) Serial.println(F("ERR"));
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
  pinMode(SILENCE_PIN, INPUT_PULLUP);
  pinMode(PUMP_PIN, OUTPUT);
  pinMode(ALARM_PIN, OUTPUT);
  setPump(false);
  setAlarm(false);
  Serial.begin(115200);
  loadThresholds();
  lastSample = millis();
}

void loop() {
  sampleLevel();
  pollSilence();
  pollSerial();
  delay(100);
}
