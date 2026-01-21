use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Attribute(u8);

impl Attribute {
    pub const MIN: u8 = 0;
    pub const MAX: u8 = 100;

    pub fn new(value: u8) -> Self {
        Self(value.clamp(Self::MIN, Self::MAX))
    }

    pub fn value(&self) -> u8 {
        self.0
    }
}

impl Default for Attribute {
    fn default() -> Self {
        Self::new(30)
    }
}

impl fmt::Display for Attribute {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_attribute_new() {
        let attr = Attribute::new(50);
        assert_eq!(attr.value(), 50);
    }

    #[test]
    fn test_attribute_new_out_of_bounds() {
        let attr = Attribute::new(150);
        assert_eq!(attr.value(), 100);
    }

    #[test]
    fn test_attribute_default() {
        let attr = Attribute::default();
        assert_eq!(attr.value(), 30);
    }

    #[test]
    fn test_attribute_display() {
        let attr = Attribute::new(50);
        assert_eq!(attr.to_string(), "50");
    }

    #[test]
    fn test_attribute_serialize() {
        let attr = Attribute::new(50);
        assert_eq!(attr.to_string(), "50");
    }
}