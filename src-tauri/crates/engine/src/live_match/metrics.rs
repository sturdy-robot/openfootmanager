//! The numbers football actually talks about.
//!
//! Goals and shots say what happened; these say how it happened. Expected
//! goals values a chance by how good it was rather than whether it went in,
//! expected assists gives the man who made it the same credit, and expected
//! threat values simply moving the ball into somewhere more dangerous — which
//! is most of what a midfielder does all afternoon and which no counting stat
//! records.
//!
//! They accumulate by squad index, like everything else the hot path touches.
//! The one wrinkle is substitution: the index is reused by whoever comes on, so
//! a departing player's tally is flushed out to his id first. Without that, a
//! striker taken off on the hour would hand his expected goals to his
//! replacement.

use std::collections::HashMap;
use std::sync::Arc;

use crate::sim::state::Band;

/// One player's advanced numbers.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub(crate) struct PlayerMetrics {
    /// Expected goals: the quality of the chances he had.
    pub xg: f64,
    /// Expected assists: the quality of the chances he created.
    pub xa: f64,
    /// Expected threat: how much danger he added by moving the ball.
    pub xt: f64,
    /// Ground covered, in kilometres. Derived, not simulated — see
    /// [`MetricTally::cover_ground`].
    pub distance_km: f64,
}

/// How dangerous it is to have the ball in each part of the pitch.
///
/// The chance a possession starting here ends in a goal. Moving the ball from
/// one band to another is worth the difference between them, which is what
/// expected threat measures — and why a pass that breaks a line is worth
/// something even when the move breaks down three touches later.
///
/// Indexed by [`Band::index`].
const THREAT: [f64; Band::COUNT] = [0.0018, 0.0055, 0.016, 0.048, 0.135];

/// How much danger there is in having the ball in `band`.
#[inline]
pub(crate) fn threat(band: Band) -> f64 {
    THREAT[band.index()]
}

/// A full-throttle player covers this far in a minute, in kilometres.
///
/// Ten and a half kilometres over ninety minutes is a busy midfielder's
/// afternoon; a centre-half covers nearer nine and a winger more.
const KM_PER_MINUTE: f64 = 0.118;

#[derive(Debug, Clone, Default)]
pub(crate) struct MetricTally {
    current: Vec<PlayerMetrics>,
    /// How hard each player works, relative to an average outfielder. Set once
    /// from where his role and slot put him.
    work_rate: Vec<f64>,
    /// Players who have been substituted off, whose index has since been taken
    /// over by someone else.
    departed: Vec<(Arc<str>, PlayerMetrics)>,
}

impl MetricTally {
    pub fn new(work_rate: Vec<f64>) -> Self {
        Self {
            current: vec![PlayerMetrics::default(); work_rate.len()],
            work_rate,
            departed: Vec::new(),
        }
    }

    pub fn add_xg(&mut self, index: usize, xg: f64) {
        if let Some(metrics) = self.current.get_mut(index) {
            metrics.xg += xg;
        }
    }

    pub fn add_xa(&mut self, index: usize, xa: f64) {
        if let Some(metrics) = self.current.get_mut(index) {
            metrics.xa += xa;
        }
    }

    pub fn add_xt(&mut self, index: usize, xt: f64) {
        if let Some(metrics) = self.current.get_mut(index) {
            metrics.xt += xt;
        }
    }

    /// Add a minute's running to everyone still on the pitch.
    ///
    /// This is **derived, not simulated**. The engine has no model of where a
    /// player is when he does not have the ball, so there is no distance here
    /// to measure. What it has is how much of the pitch his role asks him to
    /// cover and how much is left in his legs, which is enough to produce a
    /// figure that behaves sensibly — a wing-back outruns a centre-half, and
    /// everybody slows down after an hour — without pretending to be a
    /// measurement it is not.
    pub fn cover_ground(&mut self, conditions: impl Iterator<Item = f64>) {
        for ((metrics, work_rate), condition) in
            self.current.iter_mut().zip(&self.work_rate).zip(conditions)
        {
            let freshness = 0.82 + 0.18 * (condition / 100.0);
            metrics.distance_km += KM_PER_MINUTE * work_rate * freshness;
        }
    }

    /// A player is coming off. Keep what he did under his own name, because the
    /// index he leaves behind is about to belong to somebody else.
    pub fn retire(&mut self, index: usize, id: Arc<str>) {
        if let Some(metrics) = self.current.get_mut(index) {
            self.departed.push((id, *metrics));
            *metrics = PlayerMetrics::default();
        }
    }

    /// Where a player's work rate changes without him leaving the pitch — a
    /// substitution, or a change of shape.
    pub fn set_work_rate(&mut self, work_rate: Vec<f64>) {
        self.work_rate = work_rate;
    }

    /// Everyone who played, by id, including those taken off.
    pub fn by_id(&self, id_at: impl Fn(usize) -> Arc<str>) -> HashMap<Arc<str>, PlayerMetrics> {
        let mut out: HashMap<Arc<str>, PlayerMetrics> =
            HashMap::with_capacity(self.current.len() + self.departed.len());
        for (id, metrics) in &self.departed {
            let entry = out.entry(Arc::clone(id)).or_default();
            accumulate(entry, metrics);
        }
        for (index, metrics) in self.current.iter().enumerate() {
            let entry = out.entry(id_at(index)).or_default();
            accumulate(entry, metrics);
        }
        out
    }
}

fn accumulate(into: &mut PlayerMetrics, from: &PlayerMetrics) {
    into.xg += from.xg;
    into.xa += from.xa;
    into.xt += from.xt;
    into.distance_km += from.distance_km;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn threat_rises_the_closer_you_get_to_goal() {
        let ladder: Vec<f64> = Band::ALL.iter().map(|band| threat(*band)).collect();
        for pair in ladder.windows(2) {
            assert!(
                pair[1] > pair[0],
                "threat must increase up the pitch, got {ladder:?}"
            );
        }
    }

    #[test]
    fn moving_the_ball_forward_is_worth_more_than_keeping_it() {
        let sideways = threat(Band::Middle) - threat(Band::Middle);
        let forward = threat(Band::FinalThird) - threat(Band::Middle);
        assert_eq!(sideways, 0.0);
        assert!(forward > 0.0);
    }

    #[test]
    fn a_substitute_does_not_inherit_the_tally_of_the_man_he_replaced() {
        // The trap the whole `departed` list exists for. Indexes are reused, so
        // without this a striker taken off on the hour hands his expected goals
        // to whoever comes on.
        let mut tally = MetricTally::new(vec![1.0, 1.0]);
        tally.add_xg(0, 0.6);

        tally.retire(0, Arc::from("starter"));
        tally.add_xg(0, 0.2);

        let by_id = tally.by_id(|index| Arc::from(if index == 0 { "sub" } else { "other" }));
        assert_eq!(by_id[&Arc::from("starter")].xg, 0.6);
        assert_eq!(by_id[&Arc::from("sub")].xg, 0.2);
    }

    #[test]
    fn a_player_who_stayed_on_keeps_everything_he_did() {
        let mut tally = MetricTally::new(vec![1.0]);
        tally.add_xg(0, 0.3);
        tally.add_xa(0, 0.1);
        tally.add_xt(0, 0.05);

        let by_id = tally.by_id(|_| Arc::from("ever-present"));
        let metrics = by_id[&Arc::from("ever-present")];
        assert_eq!(metrics.xg, 0.3);
        assert_eq!(metrics.xa, 0.1);
        assert!((metrics.xt - 0.05).abs() < 1e-12);
    }

    #[test]
    fn a_harder_working_role_covers_more_ground() {
        let mut tally = MetricTally::new(vec![1.3, 0.8]);
        for _ in 0..90 {
            tally.cover_ground([100.0, 100.0].into_iter());
        }
        let by_id = tally.by_id(|index| Arc::from(if index == 0 { "grafter" } else { "anchor" }));
        let grafter = by_id[&Arc::from("grafter")].distance_km;
        let anchor = by_id[&Arc::from("anchor")].distance_km;
        assert!(grafter > anchor, "{grafter} vs {anchor}");
        // And both should be a plausible afternoon's work rather than an
        // arbitrary number that happens to be ordered correctly.
        assert!(
            (6.0..16.0).contains(&grafter),
            "{grafter} km is not football"
        );
        assert!((6.0..16.0).contains(&anchor), "{anchor} km is not football");
    }

    #[test]
    fn tired_legs_cover_less_ground() {
        let mut fresh = MetricTally::new(vec![1.0]);
        let mut spent = MetricTally::new(vec![1.0]);
        for _ in 0..90 {
            fresh.cover_ground([100.0].into_iter());
            spent.cover_ground([20.0].into_iter());
        }
        let distance = |t: &MetricTally| t.by_id(|_| Arc::from("p"))[&Arc::from("p")].distance_km;
        assert!(distance(&fresh) > distance(&spent));
    }
}
