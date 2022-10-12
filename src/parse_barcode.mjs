let product = {
  barcode_one: '',
  barcode_two: '',
  type: 'unsupported',
  product_number: '',
  lot_number: '',
  expiry_date: '',
};

let doubleBarcode = false;

const parseHibc = () => {
  product.type = 'hibc';

  let primaryCode = '';
  let secondaryCode = '';
  let confirmCheckDigit = true;

  if (doubleBarcode) {
    primaryCode = product.barcode_one.slice(1);
    secondaryCode = product.barcode_two;
    if (secondaryCode.charAt(0) == '+') {
      secondaryCode = secondaryCode.slice(1);
    }
  }

  if (!doubleBarcode) {
    let barcodeOneString = product.barcode_one.slice(1);
    let barcodeArray = barcodeOneString.split('/');
    primaryCode = barcodeArray.shift();

    if (barcodeArray.length == 0) {
      confirmCheckDigit = false;
    } else {
      secondaryCode = barcodeArray.join('/');
    }
  }

  // Get the primary info
  let primaryArray = primaryCode.split('');

  // Remove Manufacturer Code
  primaryArray.splice(0, 4);

  // Check digit
  let checkDigit1 = null;
  if (doubleBarcode && confirmCheckDigit) {
    checkDigit1 = primaryArray.pop();
  }

  // Remove Unit of Use
  primaryArray.pop();

  // Catalog number - unknown length, so implode the rest of the array
  product.product_number = primaryArray.join('');

  // Get the secondary info
  if (secondaryCode != '') {
    let secondaryArray = secondaryCode.split('');

    // Expiry date
    if (secondaryArray[0] == '$') {
      secondaryArray.shift();
    } else {
      let year = secondaryArray.splice(0, 2).join('');
      let offset = parseInt(secondaryArray.splice(0, 3).join(''));

      if (year < 10) {
        year = '21' + year;
      } else {
        year = '20' + year;
      }

      let dateObject = new Date('January 1, ' + year + ' 00:00:00');
      dateObject.setDate(dateObject.getDate() + offset);

      product.expiry_date = dateObject.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }

    // Two barcodes, there will be a check digit and a link digit for the secondary data
    // One barcode, there will only be a check digit for the secondary data
    if (doubleBarcode) {
      secondaryArray.pop();
      let linkDigit = secondaryArray.pop();

      // Make sure the link_digit is the same as the check digit
      if (linkDigit != checkDigit1) {
        product.type = 'invalid';
      }
    } else {
      secondaryArray.pop();
    }

    // Remove Manufacture Date
    secondaryArray.splice(-3, 3);

    // Lot Number - unknown length, so implode the rest of the array
    product.lot_number = secondaryArray.join('');
  }
};

const parseGs1 = () => {
  product.type = 'gs1';

  var invalidCode = false;
  // 01 = EDI
  // 10 = Lot
  // 17 = Expiry
  var productNumber = product.barcode_one.substring(2, 16);
  var lotExpiry = product.barcode_one.substring(16);
  var expiry = '';
  var lotNumber = '';

  // Lot and Expiry can be either way around
  // Lot First
  if (lotExpiry.substring(0, 2) == '10') {
    // unknown lot length, so go from char 2 and ignore last 8
    lotNumber = lotExpiry.slice(2, -8);

    // get the last 6 chars for the expiry
    expiry = lotExpiry.slice(-6);
  }

  // Expiry First
  else if (lotExpiry.substring(0, 2) == '17') {
    expiry = lotExpiry.substring(2, 8);
    lotNumber = lotExpiry.substring(10);
  } else {
    invalidCode = true;
  }

  let year = expiry.substring(0, 2);
  if (year < 10) {
    year = '21' + year;
  } else {
    year = '20' + year;
  }

  let month = expiry.substring(2, 4);
  let day = expiry.substring(4, 6);
  let dateObject = new Date(`${year}-${month}-${day}T00:00:00`);

  if (!invalidCode) {
    product.product_number = productNumber;
    product.lot_number = lotNumber;
    product.expiry_date = dateObject.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
};

const parseSimple = () => {
  product.type = 'simple';

  consignment_lot['barcode_two'] = barcodeTwo;

  // Catalog number
  consignment_lot['product_number'] = barcodeOne;
  consignment_lot['lot_number'] = barcodeTwo;
  consignment_lot['expiry_date'] = null;
};

export default function parse(barcodeOne, barcodeTwo) {
  product.barcode_one = barcodeOne;
  if (barcodeTwo !== undefined) {
    doubleBarcode = true;
    product.barcode_two = barcodeTwo;
  }

  // Remove * from beginning and end
  if (barcodeOne.charAt(0) == '*') {
    barcodeOne = barcodeOne.slice(0, -1);
    barcodeOne = barcodeOne.slice(1);
  }
  if (barcodeOne.charAt(0) == '+') {
    parseHibc();
  } else if (
    barcodeOne.substring(0, 2) == '01' &&
    (barcodeOne.substring(16, 18) == '10' ||
      barcodeOne.substring(16, 18) == '17')
  ) {
    parseGs1();
  } else if (!doubleBarcode) {
    parseSimple();
  }

  return product;
}
