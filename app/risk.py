def calculate_risk(
    stone_detected,
    stone_size_mm,
    pain_level,
    fever,
    vomiting,
    blood_in_urine,
    previous_history
):
    score = 0
    reasons = []

    if stone_detected:
        score += 3
        reasons.append("Stone detected in scan image.")

        if stone_size_mm > 0:
            if stone_size_mm < 5:
                score += 1
                reasons.append("Stone size is less than 5 mm.")
            elif 5 <= stone_size_mm <= 10:
                score += 2
                reasons.append("Stone size is between 5 mm and 10 mm.")
            else:
                score += 4
                reasons.append("Stone size is greater than 10 mm.")
        else:
            reasons.append("Stone size was not available.")
    else:
        reasons.append("No stone detected in scan image.")

    if pain_level >= 7:
        score += 2
        reasons.append("Severe pain reported.")
    elif pain_level >= 4:
        score += 1
        reasons.append("Moderate pain reported.")

    if fever:
        score += 3
        reasons.append("Fever may indicate infection risk.")

    if vomiting:
        score += 1
        reasons.append("Vomiting reported.")

    if blood_in_urine:
        score += 1
        reasons.append("Blood in urine reported.")

    if previous_history:
        score += 1
        reasons.append("Previous kidney stone history reported.")

    if score <= 3:
        risk = "Low"
    elif score <= 7:
        risk = "Moderate"
    else:
        risk = "High"

    return risk, reasons