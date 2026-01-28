
export function generateComplaintEmail(
    userName: string,
    airline: string,
    issues: string[],
    pnr: string
): string {

    let issueText = "";
    if (issues.includes('WIFI')) issueText += "The paid Wi-Fi service was inoperable, affecting my work. ";
    if (issues.includes('IFE')) issueText += "The In-Flight Entertainment system at my seat was malfunctioning for the entire duration. ";
    if (issues.includes('FOOD')) issueText += "The meal service was not up to the standard promised (unavailable or poor quality). ";
    if (issues.includes('SEAT')) issueText += "My seat was defective (recline mechanism broken or cushion damaged). ";
    if (issues.includes('CREW')) issueText += "I experienced unprofessional behavior from the cabin crew. ";

    return `
    Dear ${airline} Customer Relations,

    I am writing to express my disappointment regarding my recent flight (PNR: ${pnr}).
    As a loyal passenger, I expect a certain level of service, but unfortunately:
    
    ${issueText}

    This significantly impacted my travel experience. 
    I kindly request that you look into this matter and consider offering compensation in the form of frequent flyer miles or a travel voucher as a gesture of goodwill.

    Sincerely,
    ${userName}
  `;
}
