export function getETA(distance, speedKmH) {

    if (speedKmH <= 0)
        return null;

    const speedMetersSecond =
        speedKmH / 3.6;

    const seconds =
        distance / speedMetersSecond;

    return Math.ceil(seconds / 60);

}