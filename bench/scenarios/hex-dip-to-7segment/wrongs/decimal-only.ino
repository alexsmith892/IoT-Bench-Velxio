// WRONG (hex_dip_to_7segment): only decodes 0..9; values 10..15 are blanked
// instead of showing A b C d E F. Fails the pin-state contract on any hex-letter
// value. expectFailCategory: pin-state.

const int SW_PINS[4] = {2, 3, 4, 5};
const int SEG_PINS[7] = {6, 7, 8, 9, 10, 11, 12};

const byte FONT[10] = {
  0b1111110, 0b0110000, 0b1101101, 0b1111001, 0b0110011,
  0b1011011, 0b1011111, 0b1110000, 0b1111111, 0b1111011,
};

void setup() {
  for (int i = 0; i < 4; i++) pinMode(SW_PINS[i], INPUT_PULLUP);
  for (int i = 0; i < 7; i++) pinMode(SEG_PINS[i], OUTPUT);
}

void loop() {
  int value = 0;
  for (int i = 0; i < 4; i++) {
    if (digitalRead(SW_PINS[i]) == LOW) value |= (1 << i);
  }
  byte pattern = value < 10 ? FONT[value] : 0; // wrong: blanks A..F
  for (int i = 0; i < 7; i++) {
    digitalWrite(SEG_PINS[i], (pattern >> (6 - i)) & 1 ? HIGH : LOW);
  }
}
