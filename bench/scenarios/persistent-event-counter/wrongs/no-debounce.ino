// No debounce — holding the button emits multiple COUNT lines.
#include <EEPROM.h>

static const uint8_t MARKER_ADDR = 2;
static const uint8_t VALID_MARKER = 0xA5;
static const uint8_t BTN_PIN = 2;

uint16_t count = 0;

void persistCount() {
  EEPROM.update(0, (uint8_t)(count & 0xFF));
  EEPROM.update(1, (uint8_t)(count >> 8));
  EEPROM.update(MARKER_ADDR, VALID_MARKER);
}

void loadCount() {
  if (EEPROM.read(MARKER_ADDR) == VALID_MARKER) {
    count = (uint16_t)EEPROM.read(0) | ((uint16_t)EEPROM.read(1) << 8);
  } else {
    count = 0;
    persistCount();
  }
}

void printCount() {
  Serial.print(F("COUNT="));
  Serial.println(count);
}

void pollButton() {
  int r = digitalRead(BTN_PIN);
  if (r == LOW) {
    count++;
    persistCount();
    printCount();
  }
}

void handleSerialLine(const char *line, uint8_t len) {
  if (len == 5 && strncmp(line, "CLEAR", 5) == 0) {
    count = 0;
    persistCount();
    printCount();
    return;
  }
  if (len > 0) Serial.println(F("ERR"));
}

char lineBuf[16];
uint8_t lineLen = 0;

void pollSerial() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (lineLen > 0) {
        lineBuf[lineLen] = '\0';
        handleSerialLine(lineBuf, lineLen);
        lineLen = 0;
      }
    } else if (lineLen < sizeof(lineBuf) - 1) {
      lineBuf[lineLen++] = c;
    }
  }
}

void setup() {
  pinMode(BTN_PIN, INPUT_PULLUP);
  Serial.begin(115200);
  loadCount();
  printCount();
}

void loop() {
  pollButton();
  pollSerial();
}
