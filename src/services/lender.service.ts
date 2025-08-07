// lender.service.ts
import { Injectable, inject } from '@angular/core';
import { Firestore, serverTimestamp, getDoc, updateDoc, doc } from '@angular/fire/firestore';
import { Observable, of, from } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { FirestoreService } from './firestore.service';
import { UserData } from '../models/user-data.model';

export interface Lender {
  id: string;
  accountNumber?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  createdAt?: any;
  contactInfo?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    contactEmail?: string;
    contactPhone?: string;
    city?: string;
    state?: string;
  };
  productInfo?: {
    lenderTypes?: string[];
    propertyCategories?: string[];
    propertyTypes?: string[];
    loanTypes?: string[];
    minLoanAmount?: string | number;
    maxLoanAmount?: string | number;
    subcategorySelections?: string[];
    ficoScore?: number;
  };
  footprintInfo?: {
    lendingFootprint?: string[];
    states?: Record<string, boolean>;
  };
}

@Injectable({
  providedIn: 'root',
})
export class LenderService {
  private firestoreService = inject(FirestoreService);
  private firestore = inject(Firestore);


  private get db() {
    return this.firestoreService.firestore;
  }

  // Convert UserData to Lender format
  private mapUserToLender(user: UserData): Lender {
    // Create a default Lender object with empty/default values
    const lender: Lender = {
      id: user.id,
      contactInfo: {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        contactPhone: user.phone || '',
        contactEmail: user.email || '',
        city: user.city || '',
        state: user.state || '',
      },
      productInfo: {
        minLoanAmount: user['minLoanAmount'] || 1000000,
        maxLoanAmount: user['maxLoanAmount'] || 1000000,
        lenderTypes: [user['lenderType'] || ''].filter((lt) => lt !== ''),
        propertyCategories: user['propertyCategories'] || [],
        propertyTypes: user['propertyTypes'] || [],
        loanTypes: [],
        ficoScore: user['ficoScore'] || 0,
      },
      footprintInfo: {
        lendingFootprint: user['lendingFootprint'] || user['states'] || [],
      },
    };

    // Log the mapping to help debug
    console.log('Mapped user to lender:', { user, lender });

    return lender;
  }

  // Get all lenders
  getAllLenders(): Observable<Lender[]> {
    return this.firestoreService.getCollection<Lender>('lenders').pipe(
      tap((lenders) => console.log('Found lenders:', lenders.length)),
      catchError((error) => {
        console.error('Error getting lenders:', error);
        return of([]);
      })
    );
  }

  getLender(id: string): Observable<Lender | null> {
    const docRef = doc(this.db, `lenders/${id}`);
    return from(getDoc(docRef)).pipe(
      map((docSnap) => {
        if (!docSnap.exists()) {
          return null;
        }

        const data: any = docSnap.data() || {};
        const contactInfo = data.contactInfo || {};
        const productInfo = data.productInfo || {};
        const footprintInfo = data.footprintInfo || {};

        const lender: Lender = {
          id: docSnap.id,
          accountNumber: docSnap.id.substring(0, 8).toUpperCase(),
          firstName: data.firstName || contactInfo.firstName || '',
          lastName: data.lastName || contactInfo.lastName || '',
          company: data.company || contactInfo.company || '',
          email: data.email || contactInfo.contactEmail || contactInfo.email || '',
          phone: data.phone || contactInfo.contactPhone || contactInfo.phone || '',
          city: data.city || contactInfo.city || '',
          state: data.state || contactInfo.state || '',
          createdAt: data.createdAt || null,
          contactInfo: {
            ...contactInfo,
            firstName: contactInfo.firstName || data.firstName || '',
            lastName: contactInfo.lastName || data.lastName || '',
            contactEmail: contactInfo.contactEmail || data.email || '',
            contactPhone: contactInfo.contactPhone || data.phone || '',
            company: contactInfo.company || data.company || '',
            city: contactInfo.city || data.city || '',
            state: contactInfo.state || data.state || ''
          },
          productInfo: {
            ...productInfo,
            lenderTypes: productInfo.lenderTypes || data.lenderTypes || [],
            propertyCategories: productInfo.propertyCategories || data.propertyCategories || [],
            subcategorySelections: productInfo.subcategorySelections || data.subcategorySelections || []
          },

          footprintInfo: {
            lendingFootprint: footprintInfo.lendingFootprint || [],
            states: footprintInfo.states || {}
          },
        };
        console.log("🔥 Lender Firestore data raw:", data);
        console.log("🔥 productInfo.subcategorySelections:", productInfo?.subcategorySelections);
        console.log("🔥 data.subcategorySelections:", data?.subcategorySelections);


        return lender;
      })
    );
  }



  private mapLenderData(lender: any): Lender {
    console.log('🔍 Raw Firebase lender data:', lender); // Debug log

    return {
      id: lender.id,
      contactInfo: {
        // ✅ FIXED: Map from ROOT-LEVEL Firebase fields (not nested contactInfo)
        firstName: lender.firstName || '', // Root level → nested
        lastName: lender.lastName || '', // Root level → nested
        company: lender.company || '', // Root level → nested
        contactEmail: lender.email || '', // Root "email" → nested "contactEmail"
        contactPhone: lender.phone || '', // Root "phone" → nested "contactPhone"
        city: lender.city || '', // Root level → nested
        state: lender.state || '', // Root level → nested
      },
      productInfo: {
        minLoanAmount: this.parseNumericValue(
          lender.productInfo?.minLoanAmount
        ),
        maxLoanAmount: this.parseNumericValue(
          lender.productInfo?.maxLoanAmount
        ),
        lenderTypes: lender.productInfo?.lenderTypes || [],
        propertyCategories: lender.productInfo?.propertyCategories || [],
        propertyTypes: lender.productInfo?.propertyTypes || [],
        subcategorySelections: lender.productInfo?.subcategorySelections || [],
        loanTypes: lender.productInfo?.loanTypes || [],
        ficoScore: lender.productInfo?.ficoScore || 0,
      },
      footprintInfo: {
        lendingFootprint: lender.footprintInfo?.lendingFootprint || [],
      },
    };
  }

  private parseNumericValue(value: any): number {
    if (typeof value === 'number') return value;
    if (!value) return 0;

    const numericString = value.toString().replace(/[^0-9.]/g, '');
    return parseFloat(numericString) || 0;
  }

  async updateLenderFromDraft(lenderId: string, draftId: string): Promise<void> {
    console.log('📤 Updating lender from draft:', { lenderId, draftId });

    try {
      const draftRef = doc(this.firestore, `lenderDrafts/${draftId}`);
      const draftSnap = await getDoc(draftRef);

      if (draftSnap.exists()) {
        const draftData = draftSnap.data();
        console.log('✅ Draft data found:', draftData);

        const lenderRef = doc(this.firestore, `lenders/${lenderId}`);
        await updateDoc(lenderRef, {
          productInfo: draftData['product'] || {},
          footprintInfo: draftData['footprint'] || {},
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(), // optional if not already set
        });


      } else {
        console.warn('⚠️ No draft found with ID:', draftId);
      }

    } catch (err) {
      console.error('❌ Error updating lender from draft:', err);
      throw err;
    }
  }

  // Update an existing lender
  updateLender(id: string, data: Partial<Lender>): Observable<void> {
    // Convert Lender partial to UserData partial as needed
    const userData: Partial<UserData> = {
      // Map the relevant fields from Lender to UserData
      // This is simplified - you'll need to adapt it to your specific needs
      updatedAt: serverTimestamp(), // Use serverTimestamp
    };

    // Change the collection from users to lenders
    return this.firestoreService.updateDocument(`lenders/${id}`, userData);
  }

  // Replace your current searchLenders() method with this:

  searchLenders(
    lenderType: string,
    propertyCategory: string,
    state: string,
    loanAmount: string,
    loanType: string
  ): Observable<Lender[]> {
    console.log('Searching lenders with criteria (raw):', {
      lenderType,
      propertyCategory,
      state,
      loanAmount,
      loanType,
    });

    const normalize = (str: string) =>
      str
        ? str.trim().toLowerCase().replace(/\s+/g, '_')
        : '';

    const stateMap: { [key: string]: string } = {
      alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
      connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
      illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
      maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
      mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
      new_hampshire: 'NH', new_jersey: 'NJ', new_mexico: 'NM', new_york: 'NY',
      north_carolina: 'NC', north_dakota: 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
      pennsylvania: 'PA', rhode_island: 'RI', south_carolina: 'SC', south_dakota: 'SD',
      tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
      west_virginia: 'WV', wisconsin: 'WI', wyoming: 'WY', district_of_columbia: 'DC'
    };

    const filterLenderType = normalize(lenderType);
    const filterCategory = normalize(propertyCategory);
    const filterLoanType = normalize(loanType);
    const filterStateAbbr = state
      ? (state.length === 2
        ? state.toUpperCase()
        : stateMap[normalize(state)] || state.toUpperCase())
      : '';

    const filterAmount = loanAmount ? this.parseNumericValue(loanAmount) : null;

    return this.getAllLenders().pipe(
      map((lenders) =>
        lenders.filter((lender) => {
          let includeThisLender = true;

          // Lender type
          if (filterLenderType && includeThisLender) {
            const lenderTypes = (lender.productInfo?.lenderTypes || []).map(normalize);
            includeThisLender = lenderTypes.includes(filterLenderType);
          }

          // Loan type
          if (filterLoanType && includeThisLender) {
            const loanTypes = (lender.productInfo?.loanTypes || []).map(normalize);
            includeThisLender = loanTypes.includes(filterLoanType);
          }

          // Property category
          if (filterCategory && includeThisLender) {
            const categories = (lender.productInfo?.propertyCategories || []).map(normalize);
            includeThisLender = categories.includes(filterCategory);
          }

          // State
          if (filterStateAbbr && includeThisLender) {
            const states = (lender.footprintInfo?.lendingFootprint || []).map((s) =>
              s.length === 2 ? s.toUpperCase() : stateMap[normalize(s)] || s.toUpperCase()
            );
            includeThisLender = states.includes(filterStateAbbr);
          }

          // Loan amount
          if (filterAmount && includeThisLender) {
            const minAmount = this.parseNumericValue(lender.productInfo?.minLoanAmount) || 0;
            const maxAmount =
              this.parseNumericValue(lender.productInfo?.maxLoanAmount) || Number.MAX_VALUE;
            includeThisLender = filterAmount >= minAmount && filterAmount <= maxAmount;
          }

          return includeThisLender;
        })
      ),
      tap((filtered) => console.log('Filtered lenders count:', filtered.length))
    );
  }
}
