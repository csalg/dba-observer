import {createdStringToDate} from "../src/scrape";
import "mocha"
import {assert, expect} from "chai"

interface TestCase {
    input: any,
    expected: any
}

describe('Created string', () => {
    it('Should parse the created string', () => {
    // Suppose it is 1st November 2020, 10:15
    const timestamp = 1604222100*1000
    const cases : TestCase[] = [
        {
            'input': "rubbish", // If input is incomprehensible, return timestamp
            'expected': timestamp
        },
        {
            'input': "I dag kl. 8.15",
            'expected': timestamp - 120*60*1000
        },
        {
            'input': "I går kl. 9.30",
            'expected': timestamp - (24*60+45)*60*1000
        },
        {
            "input": "15. juli kl. 19.44",
            "expected": 1594842240*1000
        },
        {
            "input": "2. december kl. 8.20",   // This should parse december from the
                                                // previous year and not a future date
            "expected": 1575274800*1000
        },
    ]
    for (const case_ of cases ){
        const result = createdStringToDate(case_.input, timestamp);
        expect(result).to.be.equal(case_.expected)
    }
    })
})
