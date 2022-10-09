use rand::Rng;

pub fn get_random_f32(
    lower_bound: f32,
    upper_bound: f32,
) -> f32 {
    return rand::thread_rng().gen_range(lower_bound..upper_bound);
}

pub fn get_random_uuid() -> uuid::Uuid {
    uuid::Uuid::new_v4()
}
