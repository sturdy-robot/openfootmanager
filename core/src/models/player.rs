use crate::attribute::Attribute;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::NaiveDate;


#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub enum InjurySeverity {
    Minor,
    Medium,
    Major,
    Severe,
    Critical,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct Injury {
    pub severity: InjurySeverity,
    pub injury_type: String,
    pub description: String,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub recovery_progress: u8,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Default)]
pub struct MentalAttributes {
    pub interceptions: Attribute,
    pub leadership: Attribute,
    pub concentration: Attribute,
    pub team_work: Attribute,
    pub decision: Attribute,
    pub positioning: Attribute,
    pub awareness: Attribute,
    pub gk_positioning: Attribute,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Default)]
pub struct PhysicalAttributes {
    pub agility: Attribute,
    pub acceleration: Attribute,
    pub balance: Attribute,
    pub jumping: Attribute,
    pub fitness: Attribute,
    pub strength: Attribute,
    pub recovery: Attribute,
    pub stamina: Attribute,
    pub gk_diving: Attribute,
    pub gk_jumping: Attribute,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Default)]
pub struct TechnicalAttributes {
    pub passing: Attribute,
    pub dribbling: Attribute,
    pub shooting: Attribute,
    pub technique: Attribute,
    pub heading: Attribute,
    pub long_passing: Attribute,
    pub ball_control: Attribute,
    pub free_kick: Attribute,
    pub penalty: Attribute,
    pub crossing: Attribute,
    pub first_touch: Attribute,
    pub corner: Attribute,
    pub tackling: Attribute,
    pub marking: Attribute,
    pub long_shot: Attribute,
    pub gk_penalty: Attribute,
    pub gk_free_kick: Attribute,
    pub gk_reflexes: Attribute,
    pub gk_composure: Attribute,
}


#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct Player {
    pub id: Uuid,
    pub name: String,
    pub short_name: String,
    pub date_of_birth: NaiveDate,
    pub nationality: String,
    pub height: u8, // cm
    pub weight: u16, // kg

    pub form: Attribute,
    pub morale: Attribute,
    pub energy: Attribute,

    pub mental_attributes: MentalAttributes,
    pub physical_attributes: PhysicalAttributes,
    pub technical_attributes: TechnicalAttributes,

    pub injury: Option<Injury>,
}


impl Default for Player {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),
            name: "Player".to_string(),
            short_name: "Play".to_string(),
            date_of_birth: NaiveDate::from_ymd_opt(2005, 01, 01).unwrap(),
            nationality: "National".to_string(),
            height: 175,
            weight: 85,
            form: Attribute::default(),
            morale: Attribute::default(),
            energy: Attribute::default(),
            
            mental_attributes: MentalAttributes::default(),
            physical_attributes: PhysicalAttributes::default(),
            technical_attributes: TechnicalAttributes::default(),
            
            injury: None,
        }
    }
}