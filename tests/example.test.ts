import { beforeEach, it } from 'vitest'
import {lockAda} from './example.ts'

class someObj {
    public why;
    constructor(why: string) {
        this.why = why;
    }
    showMe() {
        return this.why;
    }
}

declare module 'vitest' {
    export interface TestContext {
      foo?: someObj
    }
  }


beforeEach(async (context) => {
  // extend context

  const test = new someObj('hello');
  context.foo = test;
})

it('should work', ({ foo }) => {

  lockAda(foo!, 1);
})