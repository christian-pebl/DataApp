import { Resend } from 'resend';
import { logger } from '../logger';

// Initialize Resend client (will be undefined if API key not set)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Generate HTML email template for pin invitation
 */
function generateInvitationEmailHTML(
  inviterName: string,
  pinName: string,
  invitationLink: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pin Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: 1px;">
                PEBL
              </h1>
              <p style="margin: 8px 0 0; color: #dbeafe; font-size: 14px; font-weight: 500;">
                Protecting Ecology Beyond Land
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 20px; font-weight: 600;">
                ${inviterName} shared a pin with you
              </h2>

              <p style="margin: 0 0 24px; color: #475569; font-size: 16px; line-height: 1.5;">
                You've been invited to collaborate on a marine data monitoring pin:
              </p>

              <div style="background-color: #f1f5f9; border-left: 4px solid #3b82f6; padding: 20px; margin: 0 0 24px; border-radius: 4px;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                  <span style="color: #1e293b; font-size: 18px; font-weight: 600; margin-left: 8px;">
                    ${pinName}
                  </span>
                </div>
              </div>

              <p style="margin: 0 0 24px; color: #475569; font-size: 16px; line-height: 1.5;">
                ${inviterName} wants to share ocean monitoring data with you. Click the button below to accept the invitation and view the pin.
              </p>

              <!-- Call to Action Button -->
              <table role="presentation" style="margin: 0 0 24px;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${invitationLink}"
                       style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600; transition: background-color 0.2s;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 16px; margin: 0 0 24px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                  <strong>Don't have a PEBL account yet?</strong><br>
                  No problem! Clicking the button above will let you create an account and accept the invitation in one step.
                </p>
              </div>

              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">
                This invitation gives you access to pin location data, associated files, and historical measurements.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 8px; color: #64748b; font-size: 12px; line-height: 1.5;">
                This email was sent by <strong>PEBL</strong> - Marine & Meteorological Data Platform
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email for pin invitation
 */
function generateInvitationEmailText(
  inviterName: string,
  pinName: string,
  invitationLink: string
): string {
  return `
PEBL - Protecting Ecology Beyond Land
Marine Data Platform

${inviterName} shared a pin with you

You've been invited to collaborate on a marine data monitoring pin:

Pin: ${pinName}

${inviterName} wants to share ocean monitoring data with you.

Accept Invitation: ${invitationLink}

Don't have a PEBL account yet?
No problem! Clicking the link above will let you create an account and accept the invitation in one step.

This invitation gives you access to pin location data, associated files, and historical measurements.

---

This email was sent by PEBL - Marine & Meteorological Data Platform
If you weren't expecting this invitation, you can safely ignore this email.
  `.trim();
}

/**
 * Send invitation email using Resend
 */
export async function sendInvitationEmail(
  inviteeEmail: string,
  inviterName: string,
  pinName: string,
  invitationLink: string
): Promise<boolean> {
  try {
    // Check if Resend is configured
    if (!resend) {
      logger.warn('Resend not configured - email not sent', {
        context: 'resend-service',
        data: {
          inviteeEmail,
          inviterName,
          pinName,
          note: 'Set RESEND_API_KEY environment variable to enable email sending'
        }
      });
      return false;
    }

    // Validate email configuration
    const fromEmail = process.env.EMAIL_FROM_ADDRESS || 'noreply@yourdomain.com';
    const fromName = process.env.EMAIL_FROM_NAME || 'PEBL Pin Sharing';

    logger.info('Sending invitation email', {
      context: 'resend-service',
      data: {
        to: inviteeEmail,
        from: `${fromName} <${fromEmail}>`,
        subject: `${inviterName} shared a pin with you on PEBL`
      }
    });

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: inviteeEmail,
      subject: `${inviterName} shared a pin with you on PEBL`,
      html: generateInvitationEmailHTML(inviterName, pinName, invitationLink),
      text: generateInvitationEmailText(inviterName, pinName, invitationLink),
    });

    if (error) {
      logger.error('Failed to send invitation email', error instanceof Error ? error : new Error(JSON.stringify(error)), {
        context: 'resend-service',
        data: { inviteeEmail, inviterName, pinName }
      });
      return false;
    }

    logger.info('Invitation email sent successfully', {
      context: 'resend-service',
      data: {
        emailId: data?.id,
        inviteeEmail
      }
    });

    return true;
  } catch (error) {
    logger.error('Error sending invitation email', error as Error, {
      context: 'resend-service',
      data: { inviteeEmail, inviterName, pinName }
    });
    return false;
  }
}
