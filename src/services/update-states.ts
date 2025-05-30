// update-states.ts
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs, doc, updateDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class StateMigrationService {
  private firestore = inject(Firestore);

  private stateMapping: Record<string, string> = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY'
  };

  async updateLenderFootprints(): Promise<void> {
    try {
      console.log('Starting lender footprint migration...');
      
      // Get all lenders
      const lendersCollection = collection(this.firestore, 'lenders');
      const querySnapshot = await getDocs(lendersCollection);
      
      let updatedCount = 0;
      
      for (const docSnapshot of querySnapshot.docs) {
        const lenderData = docSnapshot.data();
        let needsUpdate = false;
        let updatedFootprint: string[] = [];
        
        // Check footprintInfo.lendingFootprint
        if (lenderData['footprintInfo']?.['lendingFootprint']) {
          updatedFootprint = lenderData['footprintInfo']['lendingFootprint'].map(
            (state: string) => this.stateMapping[state] || state
          );
          needsUpdate = true;
        }
        
        // Also check notificationPreferences.footprint (your alternate location)
        let updatedNotificationFootprint: string[] = [];
        if (lenderData['notificationPreferences']?.['footprint']) {
          updatedNotificationFootprint = lenderData['notificationPreferences']['footprint'].map(
            (state: string) => this.stateMapping[state] || state
          );
          needsUpdate = true;
        }
        
        // Update the document if needed
        if (needsUpdate) {
          const docRef = doc(this.firestore, 'lenders', docSnapshot.id);
          const updateData: any = {};
          
          if (updatedFootprint.length > 0) {
            updateData['footprintInfo.lendingFootprint'] = updatedFootprint;
          }
          
          if (updatedNotificationFootprint.length > 0) {
            updateData['notificationPreferences.footprint'] = updatedNotificationFootprint;
          }
          
          await updateDoc(docRef, updateData);
          updatedCount++;
          
          console.log(`Updated lender ${docSnapshot.id}`);
        }
      }
      
      console.log(`Migration complete! Updated ${updatedCount} lenders.`);
      
    } catch (error) {
      console.error('Error during migration:', error);
      throw error;
    }
  }
}

