export const GREENHOUSE_FORM = `
<form id="application-form">
  <h2>Apply for this job</h2>
  <div class="field"><label for="first_name">First Name <span>*</span></label><input id="first_name" name="job_application[first_name]" type="text" /></div>
  <div class="field"><label for="last_name">Last Name *</label><input id="last_name" name="job_application[last_name]" type="text" /></div>
  <div class="field"><label for="email">Email *</label><input id="email" name="job_application[email]" type="email" /></div>
  <div class="field"><label for="phone">Phone</label><input id="phone" name="job_application[phone]" type="tel" /></div>
  <div class="field"><label for="resume">Resume/CV *</label><input id="resume" name="job_application[resume]" type="file" style="display:none" /></div>
  <div class="field"><label for="cover">Cover Letter</label><input id="cover" type="file" style="display:none" /></div>

  <div id="education_section">
    <h3>Education</h3>
    <div class="education">
      <label for="education_school_name_0">School</label><input id="education_school_name_0" type="text" />
      <label for="education_degree_0">Degree</label><select id="education_degree_0"><option value="">Select...</option><option>High School</option><option>Bachelor's Degree</option><option>Master's Degree</option></select>
      <label for="education_discipline_0">Discipline</label><input id="education_discipline_0" type="text" />
      <label for="education_start_month_0">Start Date Month</label><select id="education_start_month_0" name="education[start_date][month][]"><option value="">Select</option><option value="1">1</option><option value="8">8</option><option value="9">9</option></select>
      <label for="education_start_year_0">Start Date Year</label><input id="education_start_year_0" name="education[start_date][year][]" type="text" placeholder="YYYY" />
      <label for="education_end_month_0">End Date Month</label><select id="education_end_month_0" name="education[end_date][month][]"><option value="">Select</option><option value="5">5</option><option value="12">12</option></select>
      <label for="education_end_year_0">End Date Year</label><input id="education_end_year_0" name="education[end_date][year][]" type="text" placeholder="YYYY" />
    </div>
  </div>

  <div class="field"><label for="linkedin">LinkedIn Profile</label><input id="linkedin" name="job_application[answers_attributes][0][text_value]" type="text" /></div>
  <div class="field"><label for="website">Website</label><input id="website" name="job_application[answers_attributes][1][text_value]" type="text" /></div>
  <div class="field"><label for="hear">How did you hear about this job?</label>
    <select id="hear"><option value="">Select...</option><option>Company website</option><option>LinkedIn</option><option>Referral</option></select></div>
  <div class="field"><label for="auth">Are you legally authorized to work in the United States? *</label>
    <select id="auth"><option value="">Select...</option><option>Yes</option><option>No</option></select></div>
  <div class="field"><label for="sponsor">Will you now or in the future require sponsorship for employment visa status?</label>
    <select id="sponsor"><option value="">Select...</option><option>Yes</option><option>No</option></select></div>
  <fieldset>
    <legend>Are you related to a current or former government official?</legend>
    <label><input type="radio" name="gov" value="1" /> Yes</label>
    <label><input type="radio" name="gov" value="0" /> No</label>
  </fieldset>
  <div class="field"><label><input type="checkbox" id="ai" name="ai_ack" /> I understand that Acme may use AI tools to assist in the interview process.</label></div>
  <div class="field"><label for="why">Why do you want to work at Acme?</label><textarea id="why"></textarea></div>

  <h3>Voluntary Self-Identification</h3>
  <div class="field"><label for="gender">Gender</label><select id="gender"><option value="">Select...</option><option>Male</option><option>Female</option><option>Decline To Self Identify</option></select></div>
  <div class="field"><label for="hispanic">Hispanic/Latino</label><select id="hispanic"><option value="">Select...</option><option>Yes</option><option>No</option><option>Decline To Self Identify</option></select></div>
  <div class="field"><label for="race">Race</label><select id="race"><option value="">Select...</option><option>Asian (Not Hispanic or Latino)</option><option>White (Not Hispanic or Latino)</option><option>Decline To Self Identify</option></select></div>
  <div class="field"><label for="veteran">Veteran Status</label><select id="veteran"><option value="">Select...</option><option>I am not a protected veteran</option><option>I identify as one or more of the classifications of a protected veteran</option><option>I don't wish to answer</option></select></div>
  <div class="field"><label for="disability">Disability Status</label><select id="disability"><option value="">Select...</option><option>Yes, I have a disability, or have had one in the past</option><option>No, I do not have a disability and have not had one in the past</option><option>I do not want to answer</option></select></div>
  <button type="submit">Submit application</button>
</form>`;
