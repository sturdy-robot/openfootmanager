use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Attribute(u8);

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum AttributeError {
    #[error("attribute out of range: {value} (expected 0..=100)")]
    OutOfRange { value: u16 },
}

impl Attribute {
    pub const MIN: u8 = 0;
    pub const MAX: u8 = 100;

    pub fn new(value: u16) -> Result<Self, AttributeError> {
        if value > Self::MAX as u16 {
            return Err(AttributeError::OutOfRange { value });
        }
        Ok(Self(value as u8))
    }

    pub fn get(self) -> u8 {
        self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PersonName {
    given: String,
    family: String,
}

impl PersonName {
    pub fn new(given: impl Into<String>, family: impl Into<String>) -> Result<Self, NameError> {
        let given = given.into();
        let family = family.into();

        if given.trim().is_empty() {
            return Err(NameError::EmptyGiven);
        }
        if family.trim().is_empty() {
            return Err(NameError::EmptyFamily);
        }

        Ok(Self { given, family })
    }

    pub fn given(&self) -> &str {
        &self.given
    }

    pub fn family(&self) -> &str {
        &self.family
    }

    pub fn display(&self) -> String {
        format!("{} {}", self.given, self.family)
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum NameError {
    #[error("given name must not be empty")]
    EmptyGiven,
    #[error("family name must not be empty")]
    EmptyFamily,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlayerAttributes {
    pub pace: Attribute,
    pub passing: Attribute,
    pub finishing: Attribute,
    pub composure: Attribute,
}

impl PlayerAttributes {
    pub fn starter_pack() -> Self {
        Self {
            pace: Attribute(50),
            passing: Attribute(50),
            finishing: Attribute(50),
            composure: Attribute(50),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn attribute_range_is_enforced() {
        assert!(Attribute::new(0).is_ok());
        assert!(Attribute::new(100).is_ok());
        assert_eq!(
            Attribute::new(101).unwrap_err(),
            AttributeError::OutOfRange { value: 101 }
        );
    }

    #[test]
    fn person_name_rejects_empty_parts() {
        assert!(PersonName::new("", "X").is_err());
        assert!(PersonName::new("A", "").is_err());
        assert_eq!(
            PersonName::new("Ada", "Lovelace").unwrap().display(),
            "Ada Lovelace"
        );
    }
}
